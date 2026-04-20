const {
  getOrCreateSession,
  buildSessionId,
  updateSession
} = require("../services/inboundSessionService");

const messageRepository = require("../repositories/messageRepository");
const orchestratorAgent = require("../agents/orchestratorAgent");

async function handleInbound(req, res) {
  try {
    const { channel, userId, message, metadata } = req.body;

    if (!channel || !userId || !message) {
      return res.status(400).json({
        ok: false,
        error: "channel, userId y message son obligatorios"
      });
    }

    await getOrCreateSession(channel, userId);
    const sessionId = buildSessionId(channel, userId);

    await messageRepository.create({
      sessionId,
      sender: "user",
      message,
      detectedIntent: null,
      step: "agent_entry"
    });

    const result = await orchestratorAgent.process({
      sessionId,
      channel,
      userId,
      message,
      metadata: metadata || {}
    });

    await messageRepository.create({
      sessionId,
      sender: "bot",
      message: result.reply,
      detectedIntent: result.classification?.intent || null,
      step: "agent_response"
    });

    await updateSession(channel, userId, {
      currentStep: "agent_response",
      collectedData: {
        lastIntent: result.classification?.intent || null,
        lastConfidence:
          Number.isFinite(Number(result.classification?.confidence))
            ? Number(result.classification.confidence)
            : 0,
        lastChannel: channel,
        lastEscalate: !!result.escalate,
        lastEscalationReason: result.escalationReason || null,
        lastActionsExecuted: result.actionsExecuted || [],
        metadata: metadata || {}
      }
    });

    return res.json({
      ok: true,
      data: {
        sessionId,
        ...result
      }
    });
  } catch (error) {
    console.error("Error en inboundController:", error);
    return res.status(500).json({
      ok: false,
      error: "Error procesando mensaje entrante"
    });
  }
}

module.exports = {
  handleInbound
};