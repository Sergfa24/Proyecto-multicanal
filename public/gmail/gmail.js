/* ============================================
   NexusAI — Gmail AI Page Logic
   ============================================ */

(function () {
  "use strict";

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

  var currentFilter  = "all";
  var selectedEmailId = null;

  var emails = [
    { id: 1, sender: "Carlos García", email: "carlos.garcia@empresa.com", subject: "Reunión de proyecto — Lunes 10:00", preview: "Hola equipo, os confirmo la reunión del lunes a las 10:00 para revisar el avance del sprint...", body: "<p>Hola equipo,</p><p>Os confirmo la reunión del lunes a las 10:00 para revisar el avance del sprint actual. Por favor, preparad un resumen de vuestras tareas completadas y los bloqueos que tengáis.</p><p>La reunión será en la sala B3 o por Teams si alguien trabaja en remoto.</p><p>Saludos,<br>Carlos</p>", time: "09:45", date: "20 Abr 2026", unread: true, starred: false },
    { id: 2, sender: "María López", email: "maria.lopez@cliente.es", subject: "Re: Presupuesto actualizado Q2", preview: "Gracias por enviar el presupuesto. He revisado las cifras y tengo algunas dudas sobre...", body: "<p>Hola,</p><p>Gracias por enviar el presupuesto actualizado. He revisado las cifras y tengo algunas dudas sobre la partida de infraestructura cloud. ¿Podríamos agendar una llamada esta semana para comentarlo?</p><p>También necesitaría que me enviarais el desglose por trimestre.</p><p>Un saludo,<br>María</p>", time: "08:12", date: "20 Abr 2026", unread: true, starred: true },
    { id: 3, sender: "GitHub", email: "notifications@github.com", subject: "[Proyecto-multicanal] Pull Request #42 merged", preview: "sergfa24 merged pull request #42: feat: add voice controller and phone UI...", body: "<p><strong>sergfa24</strong> merged pull request <strong>#42</strong> into <code>main</code> from <code>oscar</code>.</p><p><strong>feat: add voice controller and phone UI</strong></p><p>Files changed: 10<br>Additions: +1,950<br>Deletions: -1</p>", time: "Ayer", date: "19 Abr 2026", unread: false, starred: false },
    { id: 4, sender: "Ana Martínez", email: "ana.martinez@empresa.com", subject: "Documentación API — revisión necesaria", preview: "He subido la primera versión de la documentación de la API REST al repositorio. Necesito que...", body: "<p>Hola,</p><p>He subido la primera versión de la documentación de la API REST al repositorio. Necesito que alguien del equipo la revise antes del viernes.</p><p>Los endpoints principales están documentados pero faltan los de administración. Si alguien puede encargarse de esa parte, genial.</p><p>¡Gracias!<br>Ana</p>", time: "Ayer", date: "19 Abr 2026", unread: false, starred: true },
    { id: 5, sender: "Google Cloud", email: "noreply@google.com", subject: "Tu factura de abril está disponible", preview: "Tu factura de Google Cloud Platform para el período del 1 al 19 de abril de 2026 está lista...", body: "<p>Hola,</p><p>Tu factura de Google Cloud Platform para el período del <strong>1 al 19 de abril de 2026</strong> ya está disponible en tu consola de facturación.</p><p><strong>Total: 47,82 €</strong></p><p>Puedes ver el desglose completo en <a href='#'>console.cloud.google.com/billing</a>.</p><p>Gracias por usar Google Cloud.</p>", time: "18 Abr", date: "18 Abr 2026", unread: true, starred: false },
    { id: 6, sender: "Pedro Sánchez", email: "pedro.sanchez@equipo.dev", subject: "Bug crítico en producción — API timeout", preview: "Chicos, estamos viendo timeouts en el endpoint /api/inbound desde las 14:00. He abierto...", body: "<p>Chicos,</p><p>Estamos viendo timeouts en el endpoint <code>/api/inbound</code> desde las 14:00. He abierto un incidente en PagerDuty.</p><p>Parece que el problema está en la conexión a la base de datos. El pool se satura cuando hay más de 50 conexiones simultáneas.</p><p>¿Alguien puede echar un vistazo urgente? Estoy intentando mitigarlo con un restart pero vuelve a pasar.</p><p>Pedro</p>", time: "18 Abr", date: "18 Abr 2026", unread: false, starred: false },
    { id: 7, sender: "LinkedIn", email: "messages@linkedin.com", subject: "Tienes 3 nuevas conexiones esta semana", preview: "Tu red sigue creciendo. 3 personas se han conectado contigo esta semana. Mira quién...", body: "<p>¡Hola!</p><p>Tu red profesional sigue creciendo. Esta semana se han conectado contigo:</p><ul><li>Laura Fernández — Frontend Developer en Spotify</li><li>Miguel Torres — CTO en StartupXYZ</li><li>Sofía Ruiz — Product Manager en Google</li></ul><p>Visita tu perfil para ver más detalles.</p>", time: "17 Abr", date: "17 Abr 2026", unread: false, starred: false }
  ];

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () { navLinks.classList.toggle("open"); });
    navLinks.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", function () { navLinks.classList.remove("open"); }); });
  }

  function renderInbox(filter, query) {
    var filtered = emails;
    if (filter === "unread") filtered = filtered.filter(function (e) { return e.unread; });
    else if (filter === "starred") filtered = filtered.filter(function (e) { return e.starred; });
    if (query) { var q = query.toLowerCase(); filtered = filtered.filter(function (e) { return e.sender.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q); }); }
    if (filtered.length === 0) { inboxList.innerHTML = '<div class="detail-empty" style="padding:2rem;height:auto;"><p style="font-size:0.85rem;color:var(--text-secondary);">No hay correos que mostrar</p></div>'; return; }
    inboxList.innerHTML = filtered.map(function (email) {
      var initials = email.sender.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2);
      var classes = "email-item"; if (email.unread) classes += " unread"; if (email.id === selectedEmailId) classes += " active";
      return '<div class="' + classes + '" data-id="' + email.id + '"><div class="email-item__avatar">' + initials + '</div><div class="email-item__content"><div class="email-item__header"><span class="email-item__sender">' + email.sender + '</span><span class="email-item__time">' + email.time + '</span></div><div class="email-item__subject">' + email.subject + '</div><div class="email-item__preview">' + email.preview + '</div></div><button class="email-item__star' + (email.starred ? ' starred' : '') + '" data-star="' + email.id + '">' + (email.starred ? '★' : '☆') + '</button></div>';
    }).join("");
    inboxList.querySelectorAll(".email-item").forEach(function (item) { item.addEventListener("click", function (e) { if (e.target.closest(".email-item__star")) return; selectEmail(parseInt(item.dataset.id)); }); });
    inboxList.querySelectorAll(".email-item__star").forEach(function (btn) { btn.addEventListener("click", function (e) { e.stopPropagation(); toggleStar(parseInt(btn.dataset.star)); }); });
  }

  function selectEmail(id) {
    var email = emails.find(function (e) { return e.id === id; }); if (!email) return;
    selectedEmailId = id; email.unread = false; renderInbox(currentFilter, searchInput.value);
    var initials = email.sender.split(" ").map(function (w) { return w[0]; }).join("").substring(0, 2);
    emailDetail.innerHTML = '<div class="email-view"><div class="email-view__header"><h1 class="email-view__subject">' + email.subject + '</h1><div class="email-view__meta"><div class="email-view__avatar">' + initials + '</div><div class="email-view__meta-info"><div class="email-view__sender">' + email.sender + '</div><div class="email-view__sender-email">&lt;' + email.email + '&gt;</div></div><div class="email-view__date">' + email.date + ' · ' + email.time + '</div></div></div><div class="email-view__body">' + email.body + '</div><div class="email-view__actions"><button class="btn-email-action" data-action="reply">↩ Responder</button><button class="btn-email-action" data-action="forward">↪ Reenviar</button><button class="btn-email-action btn-email-action--ai" data-action="ai-summarize">🤖 Resumir con IA</button><button class="btn-email-action btn-email-action--ai" data-action="ai-reply">🤖 Sugerir respuesta</button></div></div>';
    emailDetail.querySelectorAll(".btn-email-action").forEach(function (btn) { btn.addEventListener("click", function () { handleEmailAction(btn.dataset.action, email); }); });
  }

  function toggleStar(id) { var email = emails.find(function (e) { return e.id === id; }); if (email) { email.starred = !email.starred; renderInbox(currentFilter, searchInput.value); } }

  function handleEmailAction(action, email) {
    if (action === "reply") { openCompose("Re: " + email.subject, email.email); }
    else if (action === "forward") { openCompose("Fwd: " + email.subject, ""); }
    else if (action === "ai-summarize") { addAiUserMsg("Resume este correo de " + email.sender + ": \"" + email.subject + "\""); simulateAiResponse("Aquí tienes el resumen del correo de <strong>" + email.sender + "</strong>:<br><br>📌 <strong>Tema:</strong> " + email.subject + "<br>👤 <strong>De:</strong> " + email.sender + " (" + email.email + ")<br>📅 <strong>Fecha:</strong> " + email.date + "<br><br>📝 <strong>Resumen:</strong> " + email.preview + "<br><br>¿Quieres que redacte una respuesta?"); }
    else if (action === "ai-reply") { addAiUserMsg("Sugiere una respuesta para el correo de " + email.sender); simulateAiResponse("Aquí tienes una sugerencia de respuesta:<br><br>---<br>Hola " + email.sender.split(" ")[0] + ",<br><br>Gracias por tu mensaje. He revisado el contenido y me parece bien. Quedo pendiente para cualquier aclaración adicional.<br><br>Un saludo.<br>---<br><br>¿Quieres que la modifique o la envíe directamente?"); }
  }

  tabs.forEach(function (tab) { tab.addEventListener("click", function () { tabs.forEach(function (t) { t.classList.remove("active"); }); tab.classList.add("active"); currentFilter = tab.dataset.tab; renderInbox(currentFilter, searchInput.value); }); });
  searchInput.addEventListener("input", function () { renderInbox(currentFilter, searchInput.value); });
  btnRefresh.addEventListener("click", function () { btnRefresh.style.transform = "rotate(360deg)"; setTimeout(function () { btnRefresh.style.transform = ""; }, 500); renderInbox(currentFilter, searchInput.value); });

  function openCompose(subject, to) { composeOverlay.classList.remove("hidden"); document.getElementById("composeTo").value = to || ""; document.getElementById("composeSubject").value = subject || ""; document.getElementById("composeBody").value = ""; }
  btnCompose.addEventListener("click", function () { openCompose("", ""); });
  composeClose.addEventListener("click", function () { composeOverlay.classList.add("hidden"); });
  composeOverlay.addEventListener("click", function (e) { if (e.target === composeOverlay) composeOverlay.classList.add("hidden"); });
  btnComposeSend.addEventListener("click", function () { composeOverlay.classList.add("hidden"); addAiBotMsg("✅ Correo enviado correctamente. (Esto es una demo — cuando conectes tu cuenta Gmail se enviará de verdad)"); });
  btnComposeAi.addEventListener("click", function () { var subject = document.getElementById("composeSubject").value; var body = document.getElementById("composeBody"); body.value = "Hola,\n\nGracias por ponerte en contacto. He revisado tu mensaje" + (subject ? " sobre \"" + subject + "\"" : "") + " y me gustaría comentarte lo siguiente:\n\n[La IA generará aquí una respuesta personalizada basada en el contexto del correo]\n\nQuedo a tu disposición para cualquier consulta.\n\nUn saludo."; });

  function addAiUserMsg(text) { var div = document.createElement("div"); div.className = "ai-msg ai-msg--user"; div.innerHTML = '<div class="ai-msg__avatar">Tú</div><div class="ai-msg__bubble">' + text + '</div>'; aiMessages.appendChild(div); aiMessages.scrollTop = aiMessages.scrollHeight; }
  function addAiBotMsg(text) { var div = document.createElement("div"); div.className = "ai-msg ai-msg--bot"; div.innerHTML = '<div class="ai-msg__avatar">🤖</div><div class="ai-msg__bubble">' + formatAiText(text) + '</div>'; aiMessages.appendChild(div); aiMessages.scrollTop = aiMessages.scrollHeight; }
  function addTypingIndicator() { var div = document.createElement("div"); div.className = "ai-msg ai-msg--bot ai-msg--typing"; div.id = "typingIndicator"; div.innerHTML = '<div class="ai-msg__avatar">🤖</div><div class="ai-msg__bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>'; aiMessages.appendChild(div); aiMessages.scrollTop = aiMessages.scrollHeight; }
  function removeTypingIndicator() { var indicator = document.getElementById("typingIndicator"); if (indicator) indicator.remove(); }
  function formatAiText(text) { return text.replace(/\n/g, "<br>").replace(/---/g, "<hr style='border-color:rgba(111,191,115,0.15);margin:0.5rem 0;'>"); }
  function simulateAiResponse(text) { addTypingIndicator(); setTimeout(function () { removeTypingIndicator(); addAiBotMsg(text); }, 1200 + Math.random() * 800); }

  function sendAiMessage() {
    var text = aiInput.value.trim(); if (!text) return;
    addAiUserMsg(text); aiInput.value = "";
    var lower = text.toLowerCase(); var response;
    if (lower.includes("resum")) { if (selectedEmailId) { var email = emails.find(function (e) { return e.id === selectedEmailId; }); response = "📝 <strong>Resumen del correo seleccionado:</strong><br><br>De: " + email.sender + "<br>Asunto: " + email.subject + "<br><br>" + email.preview + "<br><br>¿Necesitas algo más sobre este correo?"; } else { response = "No tienes ningún correo seleccionado. Haz clic en un correo de la bandeja de entrada y luego pídeme que lo resuma."; } }
    else if (lower.includes("clasific") || lower.includes("organiz")) { response = "He analizado tu bandeja. Aquí va la clasificación:<br><br>🔴 <strong>Urgente:</strong> Bug crítico en producción (Pedro Sánchez)<br>🟡 <strong>Importante:</strong> Reunión de proyecto (Carlos García), Presupuesto Q2 (María López)<br>🔵 <strong>Normal:</strong> Documentación API (Ana Martínez), Factura Google Cloud<br>⚪ <strong>Informativo:</strong> GitHub PR merged, LinkedIn conexiones<br><br>¿Quieres que mueva alguno a una carpeta o etiqueta?"; }
    else if (lower.includes("responder") || lower.includes("respuesta") || lower.includes("reply")) { if (selectedEmailId) { var em = emails.find(function (e) { return e.id === selectedEmailId; }); response = "Aquí tienes un borrador de respuesta para " + em.sender + ":<br><br>---<br>Hola " + em.sender.split(" ")[0] + ",<br><br>Gracias por tu mensaje. Lo he revisado y estoy de acuerdo con lo que planteas. Procedemos según lo comentado.<br><br>Un saludo.<br>---<br><br>¿La envío, la edito o la abro en el editor?"; } else { response = "Selecciona primero un correo para que pueda sugerirte una respuesta."; } }
    else if (lower.includes("hola") || lower.includes("hey") || lower.includes("buenas")) { response = "¡Hola! ¿En qué puedo ayudarte? Puedo resumir correos, clasificar tu bandeja, o sugerir respuestas."; }
    else { response = "Entendido. Puedo ayudarte con:<br><br>• <strong>Resumir</strong> un correo seleccionado<br>• <strong>Clasificar</strong> tu bandeja de entrada<br>• <strong>Redactar</strong> o sugerir respuestas<br>• <strong>Buscar</strong> información en tus correos<br><br>¿Qué necesitas?"; }
    simulateAiResponse(response);
  }

  btnSendAi.addEventListener("click", sendAiMessage);
  aiInput.addEventListener("keydown", function (e) { if (e.key === "Enter") sendAiMessage(); });
  quickActions.forEach(function (btn) { btn.addEventListener("click", function () { var action = btn.dataset.action; if (action === "summarize") aiInput.value = "Resume el correo seleccionado"; else if (action === "reply") aiInput.value = "Sugiere una respuesta para el correo seleccionado"; else if (action === "classify") aiInput.value = "Clasifica y organiza mi bandeja de entrada"; sendAiMessage(); }); });

  renderInbox(currentFilter, "");
})();
