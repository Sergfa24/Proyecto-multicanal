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

  // === State ===
  var currentFilter   = "all";
  var selectedEmailId = null;
  var selectedEmail   = null;
  var gmailConnected  = false;
  var emails          = [];
  var token           = localStorage.getItem("token");

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
      return '<div class="' + classes + '" data-id="' + email.id + '">' +
        '<div class="email-item__avatar">' + initials + '</div>' +
        '<div class="email-item__content">' +
          '<div class="email-item__header"><span class="email-item__sender">' + email.sender + '</span><span class="email-item__time">' + email.time + '</span></div>' +
          '<div class="email-item__subject">' + email.subject + '</div>' +
          '<div class="email-item__preview">' + email.preview + '</div>' +
        '</div>' +
        '<button class="email-item__star' + (email.starred ? ' starred' : '') + '" data-star="' + email.id + '">' + (email.starred ? '★' : '☆') + '</button>' +
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
          '<h1 class="email-view__subject">' + email.subject + '</h1>' +
          '<div class="email-view__meta">' +
            '<div class="email-view__avatar">' + initials + '</div>' +
            '<div class="email-view__meta-info">' +
              '<div class="email-view__sender">' + email.sender + '</div>' +
              '<div class="email-view__sender-email">&lt;' + email.email + '&gt;</div>' +
            '</div>' +
            '<div class="email-view__date">' + email.date + ' · ' + email.time + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="email-view__body">' + (email.body || email.preview) + '</div>' +
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

  // === Email actions ===
  function handleEmailAction(action, email) {
    if (action === "reply") { openCompose("Re: " + email.subject, email.email); }
    else if (action === "forward") { openCompose("Fwd: " + email.subject, ""); }
    else if (action === "ai-summarize") {
      addAiUserMsg("Resume este correo de " + email.sender + ": \"" + email.subject + "\"");
      simulateAiResponse(
        "📌 <strong>Tema:</strong> " + email.subject +
        "<br>👤 <strong>De:</strong> " + email.sender + " (" + email.email + ")" +
        "<br>📅 <strong>Fecha:</strong> " + email.date +
        "<br><br>📝 <strong>Resumen:</strong> " + email.preview +
        "<br><br>¿Quieres que redacte una respuesta?"
      );
    }
    else if (action === "ai-reply") {
      addAiUserMsg("Sugiere una respuesta para el correo de " + email.sender);
      simulateAiResponse(
        "Aquí tienes una sugerencia de respuesta:<br><br>---<br>Hola " + email.sender.split(" ")[0] +
        ",<br><br>Gracias por tu mensaje. He revisado el contenido y me parece bien. Quedo pendiente para cualquier aclaración adicional.<br><br>Un saludo.<br>---<br><br>¿Quieres que la modifique o la envíe directamente?"
      );
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
    if (gmailConnected) { loadRealEmails(); }
    else { renderInbox(currentFilter, searchInput.value); }
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

  btnComposeAi.addEventListener("click", function () {
    var subject = document.getElementById("composeSubject").value;
    var body = document.getElementById("composeBody");
    body.value = "Hola,\n\nGracias por ponerte en contacto. He revisado tu mensaje" +
      (subject ? " sobre \"" + subject + "\"" : "") +
      " y me gustaría comentarte lo siguiente:\n\n[La IA generará aquí una respuesta personalizada]\n\nQuedo a tu disposición para cualquier consulta.\n\nUn saludo.";
  });

  // === AI Chat helpers ===
  function addAiUserMsg(text) {
    var div = document.createElement("div");
    div.className = "ai-msg ai-msg--user";
    div.innerHTML = '<div class="ai-msg__avatar">Tú</div><div class="ai-msg__bubble">' + text + '</div>';
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
    return text.replace(/\n/g, "<br>").replace(/---/g, "<hr style='border-color:rgba(111,191,115,0.15);margin:0.5rem 0;'>");
  }

  function simulateAiResponse(text) {
    addTypingIndicator();
    setTimeout(function () { removeTypingIndicator(); addAiBotMsg(text); }, 1200 + Math.random() * 800);
  }

  // === AI send message ===
  function sendAiMessage() {
    var text = aiInput.value.trim();
    if (!text) return;
    addAiUserMsg(text);
    aiInput.value = "";
    var lower = text.toLowerCase();
    var response;

    if (lower.includes("resum")) {
      if (selectedEmail) {
        response = "📝 <strong>Resumen del correo seleccionado:</strong><br><br>De: " + selectedEmail.sender +
          "<br>Asunto: " + selectedEmail.subject + "<br><br>" + selectedEmail.preview +
          "<br><br>¿Necesitas algo más sobre este correo?";
      } else {
        response = "No tienes ningún correo seleccionado. Haz clic en un correo de la bandeja de entrada y luego pídeme que lo resuma.";
      }
    }
    else if (lower.includes("clasific") || lower.includes("organiz")) {
      var summary = emails.slice(0, 5).map(function (e, i) {
        var icon = e.unread ? "�" : "⚪";
        return icon + " " + e.sender + ": " + e.subject;
      }).join("<br>");
      response = "He analizado tu bandeja:<br><br>" + summary + "<br><br>¿Quieres que mueva alguno a una carpeta o etiqueta?";
    }
    else if (lower.includes("responder") || lower.includes("respuesta") || lower.includes("reply")) {
      if (selectedEmail) {
        response = "Borrador de respuesta para " + selectedEmail.sender + ":<br><br>---<br>Hola " +
          selectedEmail.sender.split(" ")[0] + ",<br><br>Gracias por tu mensaje. Lo he revisado y estoy de acuerdo con lo que planteas.<br><br>Un saludo.<br>---<br><br>¿La envío, la edito o la abro en el editor?";
      } else {
        response = "Selecciona primero un correo para que pueda sugerirte una respuesta.";
      }
    }
    else if (lower.includes("hola") || lower.includes("hey") || lower.includes("buenas")) {
      response = "¡Hola! ¿En qué puedo ayudarte? Puedo resumir correos, clasificar tu bandeja, o sugerir respuestas.";
    }
    else {
      response = "Puedo ayudarte con:<br><br>• <strong>Resumir</strong> un correo seleccionado<br>• <strong>Clasificar</strong> tu bandeja de entrada<br>• <strong>Redactar</strong> o sugerir respuestas<br>• <strong>Buscar</strong> información en tus correos<br><br>¿Qué necesitas?";
    }

    simulateAiResponse(response);
  }

  btnSendAi.addEventListener("click", sendAiMessage);
  aiInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAiMessage(); });
  quickActions.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var action = btn.dataset.action;
      if (action === "summarize") aiInput.value = "Resume el correo seleccionado";
      else if (action === "reply") aiInput.value = "Sugiere una respuesta para el correo seleccionado";
      else if (action === "classify") aiInput.value = "Clasifica y organiza mi bandeja de entrada";
      sendAiMessage();
    });
  });

  // === Init ===
  checkGmailStatus();
})();
