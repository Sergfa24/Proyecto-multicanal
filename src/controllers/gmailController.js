const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const { pool } = require("../../db/mysql");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/gmail/callback"
  );
}

// GET /api/gmail/auth — Redirige al usuario a Google para autorizar
const authUrl = (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: jwt.sign({ uid: req.user.id }, JWT_SECRET, { expiresIn: "10m" }),
  });
  res.json({ ok: true, url });
};

// GET /api/gmail/callback — Google redirige aquí tras autorizar
const callback = async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Faltan parámetros de autorización");
  }

  let userId;
  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    userId = decoded.uid;
  } catch (err) {
    return res.status(400).send("Estado de autorización inválido o expirado");
  }

  if (!userId) {
    return res.status(400).send("Faltan parámetros de autorización");
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Obtener el email del usuario de Gmail
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profile.data.emailAddress;

    // Guardar tokens en BD
    const expiry = new Date(tokens.expiry_date);
    await pool.query(
      `INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_expiry, gmail_email)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
         token_expiry = VALUES(token_expiry),
         gmail_email = VALUES(gmail_email)`,
      [userId, tokens.access_token, tokens.refresh_token || "", expiry, gmailEmail]
    );

    // Redirigir al frontend de Gmail
    res.redirect("/gmail/gmail.html?connected=true");
  } catch (err) {
    console.error("Error en callback OAuth2:", err.message);
    res.redirect("/gmail/gmail.html?error=auth_failed");
  }
};

// Helper: obtener cliente autenticado para un usuario
async function getAuthenticatedClient(userId) {
  const [rows] = await pool.query(
    "SELECT access_token, refresh_token, token_expiry FROM gmail_tokens WHERE user_id = ?",
    [userId]
  );

  if (rows.length === 0) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: rows[0].access_token,
    refresh_token: rows[0].refresh_token,
    expiry_date: new Date(rows[0].token_expiry).getTime(),
  });

  // Refrescar token si ha expirado
  oauth2Client.on("tokens", async (newTokens) => {
    try {
      const newExpiry = new Date(newTokens.expiry_date);
      await pool.query(
        `UPDATE gmail_tokens SET access_token = ?, token_expiry = ? WHERE user_id = ?`,
        [newTokens.access_token, newExpiry, userId]
      );
    } catch (err) {
      console.error("Error actualizando token refrescado:", err.message);
    }
  });

  return oauth2Client;
}

// GET /api/gmail/status — Comprobar si el usuario tiene Gmail conectado
const status = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT gmail_email FROM gmail_tokens WHERE user_id = ?",
      [req.user.id]
    );
    res.json({
      ok: true,
      connected: rows.length > 0,
      email: rows[0]?.gmail_email || null,
    });
  } catch (err) {
    console.error("Error comprobando estado Gmail:", err.message);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
};

// GET /api/gmail/messages — Listar correos de la bandeja
const listMessages = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const query = req.query.q || "";
    const maxResults = parseInt(req.query.max) || 20;
    const pageToken = req.query.pageToken || undefined;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      pageToken,
      q: query || "in:inbox",
    });

    if (!listRes.data.messages || listRes.data.messages.length === 0) {
      return res.json({ ok: true, messages: [], nextPageToken: null });
    }

    // Obtener detalles de cada mensaje
    const messages = await Promise.all(
      listRes.data.messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find((h) => h.name === name)?.value || "";

        return {
          id: detail.data.id,
          threadId: detail.data.threadId,
          snippet: detail.data.snippet,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          unread: detail.data.labelIds?.includes("UNREAD") || false,
          starred: detail.data.labelIds?.includes("STARRED") || false,
          labels: detail.data.labelIds || [],
        };
      })
    );

    res.json({
      ok: true,
      messages,
      nextPageToken: listRes.data.nextPageToken || null,
    });
  } catch (err) {
    console.error("Error listando mensajes:", err.message);
    res.status(500).json({ ok: false, error: "Error al obtener correos" });
  }
};

// Helper: decode base64url from Gmail API
function decodeBase64Url(data) {
  // Gmail uses base64url encoding (RFC 4648 §5): replace - with +, _ with /
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

// GET /api/gmail/messages/:id — Leer un correo completo
const getMessage = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    const headers = detail.data.payload.headers;
    const getHeader = (name) => headers.find((h) => h.name === name)?.value || "";

    const payload = detail.data.payload;
    let htmlBody = "";
    let textBody = "";
    const cidMap = {}; // Content-ID -> { mimeType, attachmentId, data }

    // Recursively extract body parts and CID image references
    function extractParts(part) {
      const mimeType = part.mimeType || "";

      // Collect inline images (CID attachments)
      if (mimeType.startsWith("image/") && part.body) {
        const cidHeader = (part.headers || []).find(
          (h) => h.name.toLowerCase() === "content-id"
        );
        if (cidHeader) {
          const cid = cidHeader.value.replace(/^<|>$/g, "");
          cidMap[cid] = {
            mimeType,
            attachmentId: part.body.attachmentId || null,
            data: part.body.data || null,
          };
        }
      }

      // Extract HTML body
      if (mimeType === "text/html" && part.body?.data) {
        htmlBody = decodeBase64Url(part.body.data).toString("utf-8");
      }

      // Extract plain text body (fallback)
      if (mimeType === "text/plain" && part.body?.data && !textBody) {
        textBody = decodeBase64Url(part.body.data).toString("utf-8");
      }

      // Recurse into sub-parts
      if (part.parts) {
        for (const sub of part.parts) {
          extractParts(sub);
        }
      }
    }

    extractParts(payload);

    let body = htmlBody || textBody || detail.data.snippet || "";

    // Resolve CID images — replace cid:xxx with inline base64 data URIs
    const cidKeys = Object.keys(cidMap);
    if (cidKeys.length > 0 && body) {
      for (const cid of cidKeys) {
        const img = cidMap[cid];
        let base64Data = null;

        if (img.data) {
          // Data already inline in the part
          base64Data = img.data.replace(/-/g, "+").replace(/_/g, "/");
        } else if (img.attachmentId) {
          // Fetch attachment data from Gmail API
          try {
            const att = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: req.params.id,
              id: img.attachmentId,
            });
            if (att.data?.data) {
              base64Data = att.data.data.replace(/-/g, "+").replace(/_/g, "/");
            }
          } catch (attErr) {
            console.error("Error fetching CID attachment:", attErr.message);
          }
        }

        if (base64Data) {
          const dataUri = "data:" + img.mimeType + ";base64," + base64Data;
          // Replace both src="cid:xxx" variants
          body = body.replace(new RegExp('src="cid:' + cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', "gi"), 'src="' + dataUri + '"');
          body = body.replace(new RegExp("src='cid:" + cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'", "gi"), "src='" + dataUri + "'");
        }
      }
    }

    // If body is plain text, wrap in basic HTML
    if (!htmlBody && textBody) {
      body = "<pre style='white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;'>" + textBody.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>";
    }

    // Marcar como leído
    await gmail.users.messages.modify({
      userId: "me",
      id: req.params.id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });

    res.json({
      ok: true,
      message: {
        id: detail.data.id,
        threadId: detail.data.threadId,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        body,
        unread: false,
        starred: detail.data.labelIds?.includes("STARRED") || false,
        labels: detail.data.labelIds || [],
      },
    });
  } catch (err) {
    console.error("Error leyendo mensaje:", err.message);
    res.status(500).json({ ok: false, error: "Error al leer el correo" });
  }
};

// POST /api/gmail/send — Enviar un correo
const sendMessage = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }

    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ ok: false, error: "Faltan campos (to, subject, body)" });
    }

    // Sanitize header values to prevent header injection
    const safeTo = to.replace(/[\r\n]/g, "");
    const safeSubject = subject.replace(/[\r\n]/g, "");

    const gmail = google.gmail({ version: "v1", auth });

    // Construir el email en formato RFC 2822
    const email = [
      `To: ${safeTo}`,
      `Subject: ${safeSubject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      body,
    ].join("\r\n");

    const encodedEmail = Buffer.from(email).toString("base64url");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedEmail },
    });

    res.json({ ok: true, messageId: result.data.id });
  } catch (err) {
    console.error("Error enviando correo:", err.message);
    res.status(500).json({ ok: false, error: "Error al enviar el correo" });
  }
};

// POST /api/gmail/star/:id — Marcar/desmarcar estrella
const toggleStar = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const { starred } = req.body;

    await gmail.users.messages.modify({
      userId: "me",
      id: req.params.id,
      requestBody: starred
        ? { addLabelIds: ["STARRED"] }
        : { removeLabelIds: ["STARRED"] },
    });

    res.json({ ok: true, starred });
  } catch (err) {
    console.error("Error toggling star:", err.message);
    res.status(500).json({ ok: false, error: "Error al modificar el correo" });
  }
};

// GET /api/gmail/week — Cargar metadatos de emails de los últimos 7 días
const getWeekEmails = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const daysBack = parseInt(req.query.days) || 7;
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - daysBack);
    const afterEpoch = Math.floor(dateFilter.getTime() / 1000);

    // Fetch all message IDs from the period
    let allMessageIds = [];
    let pageToken = undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: `after:${afterEpoch}`,
        maxResults: 100,
        pageToken,
      });
      if (listRes.data.messages) {
        allMessageIds = allMessageIds.concat(listRes.data.messages.map((m) => m.id));
      }
      pageToken = listRes.data.nextPageToken;
    } while (pageToken && allMessageIds.length < 200); // cap at 200

    if (allMessageIds.length === 0) {
      return res.json({ ok: true, count: 0, emails: [] });
    }

    // Fetch metadata in batches to avoid rate limit exhaustion
    const BATCH_SIZE = 15;
    const emails = [];
    for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
      const batch = allMessageIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });
          const headers = detail.data.payload.headers;
          const getHeader = (name) => headers.find((h) => h.name === name)?.value || "";
          return {
            id: detail.data.id,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: detail.data.snippet,
            unread: detail.data.labelIds?.includes("UNREAD") || false,
            starred: detail.data.labelIds?.includes("STARRED") || false,
            labels: detail.data.labelIds || [],
          };
        })
      );
      emails.push(...batchResults);
    }

    res.json({ ok: true, count: emails.length, emails });
  } catch (err) {
    console.error("Error cargando emails semanales:", err.message);
    res.status(500).json({ ok: false, error: "Error al cargar emails" });
  }
};

// GET /api/gmail/labels — Listar etiquetas del usuario
const listLabels = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }
    const gmail = google.gmail({ version: "v1", auth });
    const result = await gmail.users.labels.list({ userId: "me" });
    const labels = (result.data.labels || [])
      .filter((l) => l.type === "user")
      .map((l) => ({ id: l.id, name: l.name }));
    res.json({ ok: true, labels });
  } catch (err) {
    console.error("Error listando labels:", err.message);
    res.status(500).json({ ok: false, error: "Error al listar etiquetas" });
  }
};

// POST /api/gmail/labels — Crear una nueva etiqueta
const createLabel = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ ok: false, error: "Falta el nombre de la etiqueta" });
    }
    const gmail = google.gmail({ version: "v1", auth });
    const result = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    res.json({ ok: true, label: { id: result.data.id, name: result.data.name } });
  } catch (err) {
    console.error("Error creando label:", err.message);
    res.status(500).json({ ok: false, error: "Error al crear etiqueta" });
  }
};

// POST /api/gmail/move — Mover emails a una etiqueta
const moveToLabel = async (req, res) => {
  try {
    const auth = await getAuthenticatedClient(req.user.id);
    if (!auth) {
      return res.status(401).json({ ok: false, error: "Gmail no conectado" });
    }
    const { messageIds, labelId, removeFromInbox } = req.body;
    if (!messageIds || !labelId) {
      return res.status(400).json({ ok: false, error: "Faltan messageIds o labelId" });
    }
    const gmail = google.gmail({ version: "v1", auth });
    const addLabelIds = [labelId];
    const removeLabelIds = removeFromInbox ? ["INBOX"] : [];

    let moved = 0;
    let errors = 0;
    for (const msgId of messageIds) {
      try {
        await gmail.users.messages.modify({
          userId: "me",
          id: msgId,
          requestBody: { addLabelIds, removeLabelIds },
        });
        moved++;
      } catch (moveErr) {
        errors++;
        console.warn("No se pudo mover email " + msgId + ":", moveErr.message);
      }
    }

    res.json({ ok: true, moved, errors });
  } catch (err) {
    console.error("Error moviendo emails:", err.message);
    res.status(500).json({ ok: false, error: "Error al mover emails" });
  }
};

// DELETE /api/gmail/disconnect — Desconectar Gmail
const disconnect = async (req, res) => {
  try {
    await pool.query("DELETE FROM gmail_tokens WHERE user_id = ?", [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error desconectando Gmail:", err.message);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
};

module.exports = { authUrl, callback, status, listMessages, getMessage, sendMessage, toggleStar, getWeekEmails, listLabels, createLabel, moveToLabel, disconnect };
