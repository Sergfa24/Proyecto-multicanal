const classifierAgent = require("./classifierAgent");
const knowledgeAgent = require("./knowledgeAgent");
const actionAgent = require("./actionAgent");
const channelAgent = require("./channelAgent");
const escalationAgent = require("./escalationAgent");

const {
  getRecentMessages,
  buildContextString
} = require("../services/conversationMemoryService");

async function process({ sessionId, channel, userId, message, metadata = {} }) {
  const recentMessages = await getRecentMessages(sessionId, 5);
  const context = buildContextString(recentMessages);
  const subject = metadata.subject || "";

  const analysisText = context
    ? `Contexto:\n${context}\n\nMensaje actual:\n${message}`
    : message;

  const classification = await classifierAgent.detect(analysisText, {
    channel,
    subject,
    currentStep: "agent_entry"
  });

  const escalationDecision = escalationAgent.shouldEscalate(classification, {
    channel,
    message: analysisText,
    metadata
  });

  let replyText = "";
  let escalate = false;
  let actionsExecuted = [];

  if (escalationDecision.escalate) {
    escalate = true;

    switch (escalationDecision.reason) {
      case "high_urgency":
        replyText =
          "Hemos detectado que tu consulta puede ser urgente. La vamos a dejar registrada para que una persona del equipo pueda revisarla cuanto antes.";
        break;

      case "sensitive_request":
        replyText =
          "Tu consulta necesita una revisión más específica. La vamos a dejar registrada para que el equipo pueda responderte de forma adecuada.";
        break;

      case "clarification_needed":
        replyText =
          "Hemos recibido tu mensaje, pero necesita una revisión más detallada. Lo vamos a dejar registrado para que una persona del equipo pueda ayudarte.";
        break;

      default:
        replyText =
          "Hemos recibido tu consulta y la vamos a dejar registrada para que pueda revisarla una persona del equipo.";
        break;
    }

    actionsExecuted = await actionAgent.execute({
      classification: {
        ...classification,
        intent: "contacto"
      },
      message,
      userId,
      channel,
      metadata
    });

    actionsExecuted.push("escalated_to_human");
  } else {
    const knowledge = await knowledgeAgent.getResponse({
      classification,
      channel,
      message,
      context
    });

    replyText = knowledge.text;

    actionsExecuted = await actionAgent.execute({
      classification,
      message,
      userId,
      channel,
      metadata
    });
  }

  const finalReply = channelAgent.format({
    channel,
    text: replyText
  });

  return {
    channel,
    userId,
    classification,
    escalate,
    escalationReason: escalate ? escalationDecision.reason : null,
    actionsExecuted,
    context,
    reply: finalReply
  };
}

module.exports = {
  process
};