const conversationRepository = require("../repositories/conversationRepository");

async function getSessions(req, res) {
  try {
    const sessions = await conversationRepository.getAllSessions();

    const formatted = sessions.map((session) => ({
      sessionId: session.sessionId,
      currentStep: session.currentStep,
      lastIntent: session.collectedData?.lastIntent || null,
      lastConfidence:
        Number.isFinite(Number(session.collectedData?.lastConfidence))
          ? Number(session.collectedData.lastConfidence)
          : null,
      lastChannel: session.collectedData?.lastChannel || null,
      lastEscalate: session.collectedData?.lastEscalate || false,
      lastEscalationReason: session.collectedData?.lastEscalationReason || null,
      lastActionsExecuted: session.collectedData?.lastActionsExecuted || [],
      metadata: session.collectedData?.metadata || {}
    }));

    res.json({
      ok: true,
      data: formatted
    });
  } catch (error) {
    console.error("Error en getSessions:", error);
    res.status(500).json({
      ok: false,
      error: "Error obteniendo sesiones"
    });
  }
}

async function getSessionMessages(req, res) {
  try {
    const { sessionId } = req.params;

    const messages = await conversationRepository.getMessagesBySessionId(sessionId);

    res.json({
      ok: true,
      data: messages
    });
  } catch (error) {
    console.error("Error en getSessionMessages:", error);
    res.status(500).json({
      ok: false,
      error: "Error obteniendo mensajes de la sesión"
    });
  }
}

module.exports = {
  getSessions,
  getSessionMessages
};