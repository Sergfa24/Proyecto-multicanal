const sessionsList = document.getElementById("sessions-list");
const messagesList = document.getElementById("messages-list");
const sessionDetail = document.getElementById("session-detail");

let allSessions = [];

async function loadSessions() {
  try {
    const res = await fetch("/api/admin/sessions");
    const data = await res.json();

    if (!data.ok) {
      sessionsList.innerHTML = "<p>Error cargando sesiones.</p>";
      return;
    }

    allSessions = data.data;
    renderSessions(allSessions);
  } catch (error) {
    console.error(error);
    sessionsList.innerHTML = "<p>Error cargando sesiones.</p>";
  }
}

function renderSessions(sessions) {
  if (!sessions.length) {
    sessionsList.innerHTML = "<p>No hay sesiones registradas.</p>";
    return;
  }

  sessionsList.innerHTML = sessions
    .map((session) => `
      <div class="session-card" data-session-id="${encodeURIComponent(session.sessionId)}">
        <strong>${session.sessionId}</strong>
        <div class="session-meta">Canal: ${session.lastChannel || "-"}</div>
        <div class="session-meta">Intent: ${session.lastIntent || "-"}</div>
        <div class="session-meta">Confianza: ${session.lastConfidence ?? "-"}</div>
        <div class="session-meta">Escalado: ${session.lastEscalate ? "Sí" : "No"}</div>
        <div class="session-meta">Motivo: ${session.lastEscalationReason || "-"}</div>
        <div class="session-meta">Acciones: ${(session.lastActionsExecuted || []).join(", ") || "-"}</div>
      </div>
    `)
    .join("");

  document.querySelectorAll(".session-card").forEach((card) => {
    card.addEventListener("click", () => {
      const encodedSessionId = card.getAttribute("data-session-id");
      loadMessages(encodedSessionId);
    });
  });
}

async function loadMessages(encodedSessionId) {
  try {
    const res = await fetch(`/api/admin/sessions/${encodedSessionId}/messages`);
    const data = await res.json();

    if (!data.ok) {
      messagesList.innerHTML = "<p>Error cargando mensajes.</p>";
      return;
    }

    const sessionId = decodeURIComponent(encodedSessionId);
    const session = allSessions.find((s) => s.sessionId === sessionId);
    renderSessionDetail(session);
    renderMessages(data.data);
  } catch (error) {
    console.error(error);
    messagesList.innerHTML = "<p>Error cargando mensajes.</p>";
  }
}

function renderSessionDetail(session) {
  if (!session) {
    sessionDetail.innerHTML = "";
    return;
  }

  sessionDetail.innerHTML = `
    <strong>Sesión:</strong> ${session.sessionId}<br>
    <strong>Canal:</strong> ${session.lastChannel || "-"}<br>
    <strong>Intent:</strong> ${session.lastIntent || "-"}<br>
    <strong>Confianza:</strong> ${session.lastConfidence ?? "-"}<br>
    <strong>Escalado:</strong> ${session.lastEscalate ? "Sí" : "No"}<br>
    <strong>Motivo de escalado:</strong> ${session.lastEscalationReason || "-"}<br>
    <strong>Acciones:</strong> ${(session.lastActionsExecuted || []).join(", ") || "-"}
  `;
}

function renderMessages(messages) {
  if (!messages.length) {
    messagesList.innerHTML = "<p>No hay mensajes en esta sesión.</p>";
    return;
  }

  messagesList.innerHTML = messages
    .map(
      (msg) => `
        <div class="message ${msg.sender}">
          ${escapeHtml(msg.message)}
          <small>Intent detectado: ${msg.detectedIntent || "-"}</small>
        </div>
      `
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

loadSessions();