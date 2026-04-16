function containsSensitiveRequest(text = "") {
  const normalized = String(text).toLowerCase();

  const sensitiveKeywords = [
    "presupuesto",
    "reclamacion",
    "reclamación",
    "queja",
    "denuncia",
    "urgente",
    "fuga",
    "pierde agua",
    "pierde",
    "averia grave",
    "avería grave",
    "no funciona",
    "rota",
    "roto",
    "emergencia"
  ];

  return sensitiveKeywords.some((keyword) => normalized.includes(keyword));
}

function shouldEscalate(classification, context = {}) {
  if (!classification) {
    return {
      escalate: true,
      reason: "no_classification"
    };
  }

  const confidence = classification.confidence || 0;
  const intent = classification.intent || "desconocido";
  const urgency = classification?.extractedData?.urgency || "unknown";
  const replyMode = classification?.extractedData?.replyMode || "clarify";
  const message = context.message || "";

  if (confidence < 0.45) {
    return {
      escalate: true,
      reason: "low_confidence"
    };
  }

  if (replyMode === "clarify") {
    return {
      escalate: true,
      reason: "clarification_needed"
    };
  }

  if (urgency === "alta") {
    return {
      escalate: true,
      reason: "high_urgency"
    };
  }

  if (intent === "desconocido") {
    return {
      escalate: true,
      reason: "unknown_intent"
    };
  }

  if (containsSensitiveRequest(message)) {
    return {
      escalate: true,
      reason: "sensitive_request"
    };
  }

  return {
    escalate: false,
    reason: null
  };
}

module.exports = {
  shouldEscalate
};