const { google } = require("googleapis");
const { pool } = require("../../db/mysql");

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
    state: String(req.user.id),
  });
  res.json({ ok: true, url });
};

// GET /api/gmail/callback — Google redirige aquí tras autorizar
const callback = async (req, res) => {
  const { code, state } = req.query;
  const userId = parseInt(state);

  if (!code || !userId) {
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
    const newExpiry = new Date(newTokens.expiry_date);
    await pool.query(
      `UPDATE gmail_tokens SET access_token = ?, token_expiry = ? WHERE user_id = ?`,
      [newTokens.access_token, newExpiry, userId]
    );
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

    // Extraer body (puede ser text/plain o text/html)
    let body = "";
    const payload = detail.data.payload;

    function extractBody(part) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      if (part.mimeType === "text/plain" && part.body?.data && !body) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      if (part.parts) {
        for (const sub of part.parts) {
          const result = extractBody(sub);
          if (result) return result;
        }
      }
      return null;
    }

    body = extractBody(payload) || detail.data.snippet || "";

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

    const gmail = google.gmail({ version: "v1", auth });

    // Construir el email en formato RFC 2822
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
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

module.exports = { authUrl, callback, status, listMessages, getMessage, sendMessage, toggleStar, disconnect };
