/* ============================================
   NexusAI — Gmail AI Page Logic
   Integración real con Gmail API + fallback demo
   ============================================ */

(function () {
  "use strict";

  // === DOM refs ===
  var inboxList      = document.getElementById("inboxList");
  var emailDetail    = document.getElementById("emailDetail");
  var aiMessages     = document.getElementById("aiMessages");
  var aiInput        = document.getElementById("aiInput");
  var btnSendAi      = document.getElementById("btnSendAi");
  var searchInput    = document.getElementById("searchInput");
  var btnRefresh     = document.getElementById("btnRefresh");
  var btnCompose     = document.getElementById("btnCompose");
  var composeOverlay = document.getElementById("composeOverlay");
  var composeClose   = document.getElementById("composeClose");
  var btnComposeSend = document.getElementById("btnComposeSend");
  var btnComposeAi   = document.getElementById("btnComposeAi");
  var hamburger      = document.getElementById("hamburger");
  var navLinks       = document.querySelector(".navbar__links");
  var tabs           = document.querySelectorAll(".inbox-tab");
  var quickActions   = document.querySelectorAll(".ai-quick-btn");
  var connectBanner  = document.getElementById("connectBanner");
  var connectedBar   = document.getElementById("connectedBar");
  var connectedEmail = document.getElementById("connectedEmail");
  var btnConnectGmail = document.getElementById("btnConnectGmail");
  var btnDisconnect  = document.getElementById("btnDisconnect");
  var labelsPanel    = document.getElementById("labelsPanel");
  var labelsList     = document.getElementById("labelsList");
  var inboxTitle     = document.querySelector(".inbox-toolbar__title");

  // === State ===
  var currentFilter   = "all";
  var currentLabel    = null;     // null = inbox, string = label name/id
  var currentLabelName = "Bandeja de entrada";
  var userLabels      = [];       // loaded from Gmail API
  var selectedEmailId = null;
  var selectedEmail   = null;
  var gmailConnected  = false;
  var emails          = [];
  var weekEmailsCache = null; // cached week metadata for AI context
  var token           = localStorage.getItem("token");

  // === HTML security helpers ===
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function sanitizeHtml(html) {
    if (!html) return "";
    // Strip script tags and their content
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    // Strip event handler attributes (on*)
    html = html.replace(/\s+on\w+\s*=\s*(["'])[\s\S]*?\1/gi, "");
    html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");
    // Strip javascript: URLs
    html = html.replace(/href\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href=$1#$1');
    html = html.replace(/src\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'src=$1#$1');
    // Strip <embed>, <object>, <iframe>, <form>, <meta>, <link> tags
    html = html.replace(/<\/?(embed|object|iframe|form|meta|link|base)(\s[^>]*)?\/?>([\s\S]*?<\/\1>)?/gi, "");
    return html;
  }

  // === Auth helper ===
  function authHeaders() {
    return { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
  }

  // === Parse sender "Name <email>" ===
  function parseSender(fromStr) {
    var match = fromStr.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
    if (match) return { name: match[1].trim(), email: match[2].trim() };
    return { name: fromStr, email: fromStr };
  }

  // === Format date ===
  function formatDate(dateStr) {
    try {
      var d = new Date(dateStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 86400000) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      if (diff < 172800000) return "Ayer";
      return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    } catch (e) { return dateStr; }
  }

  function formatFullDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return dateStr; }
  }

  // === Navbar mobile ===
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () { navLinks.classList.toggle("open"); });
    navLinks.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", function () { navLinks.classList.remove("open"); }); });
  }

  // === Check Gmail connection ===
  async function checkGmailStatus() {
    if (!token) {
      connectBanner.classList.remove("hidden");
      connectedBar.classList.add("hidden");
      return;
    }

    try {
      var res = await fetch("/api/gmail/status", { headers: authHeaders() });
      var data = await res.json();
      if (data.ok && data.connected) {
        gmailConnected = true;
        connectBanner.classList.add("hidden");
        connectedBar.classList.remove("hidden");
        connectedEmail.textContent = data.email;
        await loadRealEmails();
        // Preload week emails metadata in background for AI context (lightweight)
        loadWeekEmails();
        loadLabels();
      } else {
        gmailConnected = false;
        connectBanner.classList.remove("hidden");
        connectedBar.classList.add("hidden");
        loadDemoEmails();
      }
    } catch (err) {
      console.error("Error checking Gmail status:", err);
      connectBanner.classList.remove("hidden");
      loadDemoEmails();
    }
  }

  // === Connect Gmail ===
  if (btnConnectGmail) {
    btnConnectGmail.addEventListener("click", async function () {
      if (!token) {
        window.location.href = "../auth/login.html";
        return;
      }
      try {
        var res = await fetch("/api/gmail/auth", { headers: authHeaders() });
        var data = await res.json();
        if (data.ok && data.url) {
          window.location.href = data.url;
        }
      } catch (err) {
        console.error("Error conectando Gmail:", err);
      }
    });
  }

  // === Disconnect Gmail ===
  if (btnDisconnect) {
    btnDisconnect.addEventListener("click", async function () {
      try {
        await fetch("/api/gmail/disconnect", { method: "DELETE", headers: authHeaders() });
        gmailConnected = false;
        connectedBar.classList.add("hidden");
        connectBanner.classList.remove("hidden");
        loadDemoEmails();
        addAiBotMsg("Gmail desconectado. Estás viendo correos de demostración.");
      } catch (err) {
        console.error("Error desconectando:", err);
      }
    });
  }

  // === Load Gmail labels ===
  async function loadLabels() {
    try {
      var res = await fetch("/api/gmail/labels", { headers: authHeaders() });
      var data = await res.json();
      if (data.ok) {
        // Filter: only user-created labels (exclude system ones like INBOX, SENT, etc.)
        var systemLabels = ["INBOX","SENT","DRAFT","TRASH","SPAM","STARRED","UNREAD","IMPORTANT","CATEGORY_PERSONAL","CATEGORY_SOCIAL","CATEGORY_PROMOTIONS","CATEGORY_UPDATES","CATEGORY_FORUMS","CHAT"];
        userLabels = data.labels.filter(function (l) {
          return systemLabels.indexOf(l.id) === -1;
        });
        renderLabels();
      }
    } catch (err) {
      console.error("Error loading labels:", err);
    }
  }

  function renderLabels() {
    if (userLabels.length === 0) {
      labelsPanel.classList.add("hidden");
      return;
    }
    labelsPanel.classList.remove("hidden");

    var html = '<button class="label-item' + (currentLabel === null ? ' active' : '') + '" data-label-id="">' +
      '<span class="label-item__icon">📥</span><span class="label-item__name">Bandeja de entrada</span></button>';

    userLabels.forEach(function (l) {
      var isActive = currentLabel === l.id ? " active" : "";
      html += '<button class="label-item' + isActive + '" data-label-id="' + escapeHtml(l.id) + '" data-label-name="' + escapeHtml(l.name) + '">' +
        '<span class="label-item__icon">📁</span><span class="label-item__name">' + escapeHtml(l.name) + '</span></button>';
    });

    labelsList.innerHTML = html;

    labelsList.querySelectorAll(".label-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var labelId = btn.dataset.labelId;
        var labelName = btn.dataset.labelName || "Bandeja de entrada";
        selectLabel(labelId || null, labelName);
      });
    });
  }

  async function selectLabel(labelId, labelName) {
    currentLabel = labelId;
    currentLabelName = labelName || "Bandeja de entrada";
    inboxTitle.textContent = currentLabelName;
    renderLabels();

    if (!gmailConnected) return;

    // Load emails filtered by label
    if (labelId) {
      await loadRealEmails("label:" + currentLabelName);
    } else {
      await loadRealEmails();
    }
  }

  // === Load real emails from API ===
  async function loadRealEmails(query) {
    inboxList.innerHTML = '<div class="detail-empty" style="padding:2rem;height:auto;"><p style="font-size:0.85rem;color:var(--text-secondary);">Cargando correos...</p></div>';
    try {
      var url = "/api/gmail/messages?max=20";
      if (query) url += "&q=" + encodeURIComponent(query);
      var res = await fetch(url, { headers: authHeaders() });
      var data = await res.json();
      if (!data.ok) throw new Error(data.error);

      emails = data.messages.map(function (msg) {
        var sender = parseSender(msg.from);
        return {
          id: msg.id,
          sender: sender.name,
          email: sender.email,
          subject: msg.subject || "(Sin asunto)",
          preview: msg.snippet || "",
          body: null,
          time: formatDate(msg.date),
          date: formatFullDate(msg.date),
          rawDate: msg.date,
          unread: msg.unread,
          starred: msg.starred,
        };
      });

      renderInbox(currentFilter, "");
    } catch (err) {
      console.error("Error cargando correos:", err);
      inboxList.innerHTML = '<div class="detail-empty" style="padding:2rem;height:auto;"><p style="font-size:0.85rem;color:var(--text-secondary);">Error al cargar correos</p></div>';
    }
  }

  // === Load demo emails ===
  function loadDemoEmails() {
    emails = [
      { id: "demo1", sender: "Carlos García", email: "carlos.garcia@empresa.com", subject: "Reunión de proyecto — Lunes 10:00", preview: "Hola equipo, os confirmo la reunión del lunes a las 10:00 para revisar el avance del sprint...", body: "<p>Hola equipo,</p><p>Os confirmo la reunión del lunes a las 10:00 para revisar el avance del sprint actual. Por favor, preparad un resumen de vuestras tareas completadas y los bloqueos que tengáis.</p><p>Saludos,<br>Carlos</p>", time: "09:45", date: "20 Abr 2026", unread: true, starred: false },
      { id: "demo2", sender: "María López", email: "maria.lopez@cliente.es", subject: "Re: Presupuesto actualizado Q2", preview: "Gracias por enviar el presupuesto. He revisado las cifras y tengo algunas dudas sobre...", body: "<p>Hola,</p><p>Gracias por enviar el presupuesto actualizado. He revisado las cifras y tengo algunas dudas sobre la partida de infraestructura cloud. ¿Podríamos agendar una llamada?</p><p>Un saludo,<br>María</p>", time: "08:12", date: "20 Abr 2026", unread: true, starred: true },
      { id: "demo3", sender: "GitHub", email: "notifications@github.com", subject: "[Proyecto-multicanal] Pull Request #42 merged", preview: "sergfa24 merged pull request #42: feat: add voice controller and phone UI...", body: "<p><strong>sergfa24</strong> merged pull request <strong>#42</strong> into <code>main</code>.</p><p>Files changed: 10</p>", time: "Ayer", date: "19 Abr 2026", unread: false, starred: false },
      { id: "demo4", sender: "Ana Martínez", email: "ana.martinez@empresa.com", subject: "Documentación API — revisión necesaria", preview: "He subido la primera versión de la documentación de la API REST al repositorio...", body: "<p>He subido la documentación. Necesito que alguien la revise antes del viernes.</p><p>¡Gracias!<br>Ana</p>", time: "Ayer", date: "19 Abr 2026", unread: false, starred: true },
    ];
    renderInbox(currentFilter, "");
  }

  // === Render inbox ===
  function renderInbox(filter, query) {
    var filtered = emails;
    if (filter === "unread") filtered = filtered.filter(function (e) { return e.unread; });
    else if (filter === "starred") filtered = filtered.filter(function (e) { return e.starred; });
    if (query) {
      var q = query.toLowerCase();
      filtered = filtered.filter(function (e) {
        return e.sender.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
      });
    }
    if (filtered.length === 0) {
      inboxList.innerHTML = '<div class="detail-empty" style="padding:2rem;height:auto;"><p style="font-size:0.85rem;color:var(--text-secondary);">No hay correos que mostrar</p></div>';
      return;
    }
    inboxList.innerHTML = filtered.map(function (email) {
      var initials = email.sender.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2);
      var classes = "email-item";
      if (email.unread) classes += " unread";
      if (email.id === selectedEmailId) classes += " active";
      return '<div class="' + classes + '" data-id="' + escapeHtml(email.id) + '">' +
        '<div class="email-item__avatar">' + escapeHtml(initials) + '</div>' +
        '<div class="email-item__content">' +
          '<div class="email-item__header"><span class="email-item__sender">' + escapeHtml(email.sender) + '</span><span class="email-item__time">' + escapeHtml(email.time) + '</span></div>' +
          '<div class="email-item__subject">' + escapeHtml(email.subject) + '</div>' +
          '<div class="email-item__preview">' + escapeHtml(email.preview) + '</div>' +
        '</div>' +
        '<button class="email-item__star' + (email.starred ? ' starred' : '') + '" data-star="' + escapeHtml(email.id) + '">' + (email.starred ? '★' : '☆') + '</button>' +
      '</div>';
    }).join("");

    inboxList.querySelectorAll(".email-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        if (e.target.closest(".email-item__star")) return;
        selectEmail(item.dataset.id);
      });
    });
    inboxList.querySelectorAll(".email-item__star").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleStar(btn.dataset.star);
      });
    });
  }

  // === Select email ===
  async function selectEmail(id) {
    selectedEmailId = id;
    var email = emails.find(function (e) { return e.id === id; });
    if (!email) return;

    // Si es un correo real y aún no tenemos el body, lo cargamos
    if (gmailConnected && !email.body) {
      emailDetail.innerHTML = '<div class="detail-empty"><p>Cargando correo...</p></div>';
      try {
        var res = await fetch("/api/gmail/messages/" + id, { headers: authHeaders() });
        var data = await res.json();
        if (data.ok) {
          email.body = data.message.body;
          email.unread = false;
        }
      } catch (err) {
        console.error("Error cargando correo:", err);
        email.body = "<p>Error al cargar el contenido del correo</p>";
      }
    } else {
      email.unread = false;
    }

    selectedEmail = email;
    renderInbox(currentFilter, searchInput.value);

    var initials = email.sender.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2);
    emailDetail.innerHTML =
      '<div class="email-view">' +
        '<div class="email-view__header">' +
          '<h1 class="email-view__subject">' + escapeHtml(email.subject) + '</h1>' +
          '<div class="email-view__meta">' +
            '<div class="email-view__avatar">' + escapeHtml(initials) + '</div>' +
            '<div class="email-view__meta-info">' +
              '<div class="email-view__sender">' + escapeHtml(email.sender) + '</div>' +
              '<div class="email-view__sender-email">&lt;' + escapeHtml(email.email) + '&gt;</div>' +
            '</div>' +
            '<div class="email-view__date">' + escapeHtml(email.date) + ' · ' + escapeHtml(email.time) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="email-view__body">' + sanitizeHtml(email.body || email.preview) + '</div>' +
        '<div class="email-view__actions">' +
          '<button class="btn-email-action" data-action="reply">↩ Responder</button>' +
          '<button class="btn-email-action" data-action="forward">↪ Reenviar</button>' +
          '<button class="btn-email-action btn-email-action--ai" data-action="ai-summarize">🤖 Resumir con IA</button>' +
          '<button class="btn-email-action btn-email-action--ai" data-action="ai-reply">🤖 Sugerir respuesta</button>' +
        '</div>' +
      '</div>';

    emailDetail.querySelectorAll(".btn-email-action").forEach(function (btn) {
      btn.addEventListener("click", function () { handleEmailAction(btn.dataset.action, email); });
    });
  }

  // === Toggle star ===
  async function toggleStar(id) {
    var email = emails.find(function (e) { return e.id === id; });
    if (!email) return;
    email.starred = !email.starred;
    renderInbox(currentFilter, searchInput.value);

    if (gmailConnected && !String(id).startsWith("demo")) {
      try {
        await fetch("/api/gmail/star/" + id, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ starred: email.starred }),
        });
      } catch (err) {
        console.error("Error toggling star:", err);
      }
    }
  }

  // === Load week emails metadata (background, cached) ===
  async function loadWeekEmails() {
    try {
      console.log("Loading week emails...");
      var res = await fetch("/api/gmail/week?days=3", { headers: authHeaders() });
      var data = await res.json();
      console.log("Week emails response:", res.status, data.ok, data.count);
      if (data.ok) {
        weekEmailsCache = data.emails;
        console.log("Week emails cached:", data.count, "emails");
      } else {
        console.error("Week emails error:", data.error);
      }
    } catch (err) {
      console.error("Error loading week emails:", err);
    }
  }

  // === AI API call ===
  async function callAiEmail(action, userMessage) {
    if (!token) {
      addAiBotMsg("Inicia sesión para usar la IA.");
      return;
    }
    var payload = { action: action, userMessage: userMessage };

    // Attach current email context if one is open
    if (selectedEmail) {
      payload.emailBody = selectedEmail.body || selectedEmail.preview;
      payload.emailSubject = selectedEmail.subject;
      payload.emailFrom = selectedEmail.sender + " <" + selectedEmail.email + ">";
    }

    // Attach week emails for week-* actions or chat with week context
    var needsWeek = action.startsWith("week") || action === "chat";
    if (needsWeek && weekEmailsCache) {
      payload.weekEmails = weekEmailsCache;
    }

    addTypingIndicator();
    try {
      var res = await fetch("/api/ai/email", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      removeTypingIndicator();
      var data = await res.json();
      if (data.ok) {
        addAiBotMsg(data.response);
      } else {
        addAiBotMsg("⚠️ " + (data.error || "Error al procesar con IA"));
      }
    } catch (err) {
      removeTypingIndicator();
      addAiBotMsg("⚠️ Error de conexión con la IA.");
      console.error("AI error:", err);
    }
  }

  // === AI Organize: ask AI for plan, show it, let user execute ===
  async function callAiOrganize() {
    if (!token) { addAiBotMsg("Inicia sesión para usar la IA."); return; }
    if (!weekEmailsCache || weekEmailsCache.length === 0) {
      addAiBotMsg("No hay emails cargados para organizar. Conecta tu Gmail primero.");
      return;
    }
    addTypingIndicator();
    try {
      var res = await fetch("/api/ai/organize", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ weekEmails: weekEmailsCache }),
      });
      removeTypingIndicator();
      var data = await res.json();

      if (!data.ok) {
        addAiBotMsg("⚠️ " + (data.error || "Error al organizar"));
        return;
      }

      if (!data.plan || data.plan.length === 0) {
        addAiBotMsg(data.response || "No se pudo generar un plan de organización.");
        return;
      }

      // Show the plan
      var planHtml = "<strong>📂 Plan de organización (" + data.emailCount + " emails):</strong><br><br>";
      data.plan.forEach(function (label) {
        planHtml += "🏷️ <strong>" + label.name + "</strong> — " + label.emailIds.length + " emails<br>";
      });
      planHtml += "<br>" + (data.summary || "");
      planHtml += '<br><br><button class="ai-execute-btn" id="btnExecuteOrganize">✅ Aplicar organización</button>';
      planHtml += ' <button class="ai-cancel-btn" id="btnCancelOrganize">❌ Cancelar</button>';
      addAiBotMsg(planHtml);

      // Store plan for execution
      window._aiOrganizePlan = data.plan;

      // Attach event listeners after DOM update
      setTimeout(function () {
        var btnExec = document.getElementById("btnExecuteOrganize");
        var btnCancel = document.getElementById("btnCancelOrganize");
        if (btnExec) btnExec.addEventListener("click", executeOrganizePlan);
        if (btnCancel) btnCancel.addEventListener("click", function () {
          addAiBotMsg("Organización cancelada. Tus correos no se han movido.");
          window._aiOrganizePlan = null;
        });
      }, 100);
    } catch (err) {
      removeTypingIndicator();
      addAiBotMsg("⚠️ Error de conexión con la IA.");
      console.error("Organize error:", err);
    }
  }

  // Execute the organize plan: create labels + move emails
  async function executeOrganizePlan() {
    var plan = window._aiOrganizePlan;
    if (!plan || plan.length === 0) {
      addAiBotMsg("No hay plan para ejecutar.");
      return;
    }
    addAiBotMsg("⏳ Creando carpetas y moviendo emails...");

    var created = 0;
    var moved = 0;
    var errors = [];

    for (var i = 0; i < plan.length; i++) {
      var labelPlan = plan[i];
      try {
        // Create label
        var labelRes = await fetch("/api/gmail/labels", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ name: labelPlan.name }),
        });
        var labelData = await labelRes.json();

        if (!labelData.ok) {
          errors.push("No se pudo crear '" + labelPlan.name + "': " + (labelData.error || ""));
          continue;
        }
        created++;

        // Move emails to label
        if (labelPlan.emailIds && labelPlan.emailIds.length > 0) {
          var moveRes = await fetch("/api/gmail/move", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              messageIds: labelPlan.emailIds,
              labelId: labelData.label.id,
              removeFromInbox: false,
            }),
          });
          var moveData = await moveRes.json();
          if (moveData.ok) {
            moved += moveData.moved;
          } else {
            errors.push("Error moviendo emails a '" + labelPlan.name + "'");
          }
        }
      } catch (err) {
        errors.push("Error con '" + labelPlan.name + "': " + err.message);
      }
    }

    // Report results
    var resultHtml = "✅ <strong>Organización completada:</strong><br>";
    resultHtml += "📁 " + created + " carpetas creadas<br>";
    resultHtml += "📧 " + moved + " emails organizados<br>";
    if (errors.length > 0) {
      resultHtml += "<br>⚠️ Errores:<br>" + errors.join("<br>");
    }
    resultHtml += "<br><br>Los cambios se reflejan en tu Gmail real.";
    addAiBotMsg(resultHtml);
    window._aiOrganizePlan = null;

    // Refresh inbox and labels
    if (gmailConnected) { await loadRealEmails(); loadWeekEmails(); loadLabels(); }
  }

  // === Email actions ===
  function handleEmailAction(action, email) {
    if (action === "reply") { openCompose("Re: " + email.subject, email.email); }
    else if (action === "forward") { openCompose("Fwd: " + email.subject, ""); }
    else if (action === "ai-summarize") {
      addAiUserMsg("Resume este correo de " + email.sender + ": \"" + email.subject + "\"");
      callAiEmail("summarize");
    }
    else if (action === "ai-reply") {
      addAiUserMsg("Sugiere una respuesta para el correo de " + email.sender);
      callAiEmail("reply");
    }
  }

  // === Tabs ===
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      currentFilter = tab.dataset.tab;
      renderInbox(currentFilter, searchInput.value);
    });
  });

  // === Search ===
  var searchTimeout;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    var query = searchInput.value;
    if (gmailConnected && query.length > 2) {
      searchTimeout = setTimeout(function () { loadRealEmails(query); }, 500);
    } else {
      renderInbox(currentFilter, query);
    }
  });

  // === Refresh ===
  btnRefresh.addEventListener("click", function () {
    btnRefresh.style.transform = "rotate(360deg)";
    setTimeout(function () { btnRefresh.style.transform = ""; }, 500);
    if (gmailConnected) {
      if (currentLabel) { loadRealEmails("label:" + currentLabelName); }
      else { loadRealEmails(); }
      loadLabels();
    } else { renderInbox(currentFilter, searchInput.value); }
  });

  // === Compose ===
  function openCompose(subject, to) {
    composeOverlay.classList.remove("hidden");
    document.getElementById("composeTo").value = to || "";
    document.getElementById("composeSubject").value = subject || "";
    document.getElementById("composeBody").value = "";
  }

  btnCompose.addEventListener("click", function () { openCompose("", ""); });
  composeClose.addEventListener("click", function () { composeOverlay.classList.add("hidden"); });
  composeOverlay.addEventListener("click", function (e) { if (e.target === composeOverlay) composeOverlay.classList.add("hidden"); });

  btnComposeSend.addEventListener("click", async function () {
    var to = document.getElementById("composeTo").value.trim();
    var subject = document.getElementById("composeSubject").value.trim();
    var body = document.getElementById("composeBody").value.trim();

    if (!to || !subject || !body) {
      addAiBotMsg("Rellena todos los campos (Para, Asunto, Mensaje) antes de enviar.");
      return;
    }

    if (gmailConnected) {
      try {
        var res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ to: to, subject: subject, body: body }),
        });
        var data = await res.json();
        if (data.ok) {
          composeOverlay.classList.add("hidden");
          addAiBotMsg("✅ Correo enviado correctamente a " + to);
        } else {
          addAiBotMsg("❌ Error al enviar: " + data.error);
        }
      } catch (err) {
        addAiBotMsg("❌ Error de conexión al enviar el correo.");
      }
    } else {
      composeOverlay.classList.add("hidden");
      addAiBotMsg("✅ Correo enviado (demo). Conecta tu Gmail para enviar correos de verdad.");
    }
  });

  btnComposeAi.addEventListener("click", async function () {
    var subject = document.getElementById("composeSubject").value;
    var bodyEl = document.getElementById("composeBody");
    var to = document.getElementById("composeTo").value;

    if (!token) { bodyEl.value = "Inicia sesión para usar la IA."; return; }

    bodyEl.value = "Generando borrador con IA...";
    btnComposeAi.disabled = true;

    try {
      var res = await fetch("/api/ai/email", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "chat",
          userMessage: "Redacta un email profesional en español" +
            (to ? " dirigido a " + to : "") +
            (subject ? " sobre: " + subject : "") +
            ". Solo el cuerpo del email, sin asunto ni cabeceras.",
        }),
      });
      var data = await res.json();
      bodyEl.value = data.ok ? data.response : "Error al generar borrador.";
    } catch (err) {
      bodyEl.value = "Error de conexión con la IA.";
    }
    btnComposeAi.disabled = false;
  });

  // === AI Chat helpers ===
  function addAiUserMsg(text) {
    var div = document.createElement("div");
    div.className = "ai-msg ai-msg--user";
    div.innerHTML = '<div class="ai-msg__avatar">Tú</div><div class="ai-msg__bubble">' + escapeHtml(text) + '</div>';
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function addAiBotMsg(text) {
    var div = document.createElement("div");
    div.className = "ai-msg ai-msg--bot";
    div.innerHTML = '<div class="ai-msg__avatar">🤖</div><div class="ai-msg__bubble">' + formatAiText(text) + '</div>';
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function addTypingIndicator() {
    var div = document.createElement("div");
    div.className = "ai-msg ai-msg--bot ai-msg--typing";
    div.id = "typingIndicator";
    div.innerHTML = '<div class="ai-msg__avatar">🤖</div><div class="ai-msg__bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    var indicator = document.getElementById("typingIndicator");
    if (indicator) indicator.remove();
  }

  function formatAiText(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")  // **bold**
      .replace(/\*(.+?)\*/g, "<em>$1</em>")               // *italic*
      .replace(/^### (.+)$/gm, "<strong style='font-size:1.05em'>$1</strong>") // ### heading
      .replace(/^## (.+)$/gm, "<strong style='font-size:1.1em'>$1</strong>")   // ## heading
      .replace(/^# (.+)$/gm, "<strong style='font-size:1.15em'>$1</strong>")   // # heading
      .replace(/^- (.+)$/gm, "• $1")                      // - list items
      .replace(/^\d+\.\s/gm, function(m) { return m; })   // numbered lists
      .replace(/\n/g, "<br>")
      .replace(/---/g, "<hr style='border-color:rgba(111,191,115,0.15);margin:0.5rem 0;'>");
  }

  // === AI send message ===
  function sendAiMessage() {
    var text = aiInput.value.trim();
    if (!text) return;
    addAiUserMsg(text);
    aiInput.value = "";
    var lower = text.toLowerCase();

    // Week-level commands (work with cached metadata, no extra API calls)
    var isWeekCmd = lower.includes("semana") || lower.includes("week") || lower.includes("últimos") || lower.includes("ultimos") || lower.includes("3 día") || lower.includes("3 dia") || lower.includes("recientes");
    var isOrgCmd = lower.includes("organiz") || lower.includes("carpeta") || lower.includes("etiqueta") || lower.includes("label") || lower.includes("clasific");
    var isImportantCmd = lower.includes("important") || lower.includes("urgent") || lower.includes("priorit") || lower.includes("pendiente");

    if (isWeekCmd && isOrgCmd) {
      if (!weekEmailsCache) { addAiBotMsg("Conecta tu Gmail para que pueda analizar tus emails recientes."); return; }
      callAiOrganize();
    }
    else if (isWeekCmd && isImportantCmd) {
      if (!weekEmailsCache) { addAiBotMsg("Conecta tu Gmail para que pueda analizar tus emails recientes."); return; }
      callAiEmail("week-important", text);
    }
    else if (isWeekCmd && lower.includes("resum")) {
      if (!weekEmailsCache) { addAiBotMsg("Conecta tu Gmail para que pueda analizar tus emails recientes."); return; }
      callAiEmail("week-summary", text);
    }
    else if (isWeekCmd) {
      if (!weekEmailsCache) { addAiBotMsg("Conecta tu Gmail para que pueda analizar tus emails recientes."); return; }
      callAiEmail("week-summary", text);
    }
    // Single email commands (need a selected email)
    else if (lower.includes("resum")) {
      if (selectedEmail) { callAiEmail("summarize", text); }
      else { addAiBotMsg("Selecciona un correo o pídeme un resumen de los últimos días."); }
    }
    else if (isOrgCmd) {
      if (weekEmailsCache) { callAiOrganize(); }
      else if (selectedEmail) { callAiEmail("classify", text); }
      else { addAiBotMsg("Selecciona un correo para clasificarlo o conecta Gmail para organizar tus emails."); }
    }
    else if (lower.includes("responder") || lower.includes("respuesta") || lower.includes("reply") || lower.includes("redact")) {
      if (selectedEmail) { callAiEmail("reply", text); }
      else { addAiBotMsg("Selecciona primero un correo para que pueda sugerirte una respuesta."); }
    }
    else {
      // General chat — includes week context if available
      callAiEmail("chat", text);
    }
  }

  btnSendAi.addEventListener("click", sendAiMessage);
  aiInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAiMessage(); });
  quickActions.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var action = btn.dataset.action;
      if (action === "week-organize") {
        addAiUserMsg("Organiza mis emails recientes en carpetas");
        callAiOrganize();
        return;
      }
      if (action === "summarize") aiInput.value = "Resume el correo seleccionado";
      else if (action === "reply") aiInput.value = "Sugiere una respuesta para el correo seleccionado";
      else if (action === "classify") aiInput.value = "Clasifica y organiza mi bandeja de entrada";
      else if (action === "week-summary") aiInput.value = "Resume mis emails de los últimos días";
      else if (action === "week-important") aiInput.value = "Cuáles son los emails más importantes de los últimos días";
      sendAiMessage();
    });
  });

  // === Init ===
  checkGmailStatus();
})();
