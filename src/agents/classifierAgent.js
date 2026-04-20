const { detectIntentWithLLM } = require("../services/llmService");

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function mapToAgentIntent(rawIntent) {
  switch (rawIntent) {
    case "horario":
      return "horario";
    case "ubicacion":
      return "ubicacion";
    case "contacto":
      return "contacto";
    case "instalaciones":
      return "solicitud_servicio";
    case "materiales":
      return "materiales";
    case "productos":
      return "productos";
    case "menu":
      return "menu";
    default:
      return "desconocido";
  }
}

function normalizeConfidence(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function detect(message = "", options = {}) {
  const text = String(message).toLowerCase().trim();
  const { channel = "web", subject = "", currentStep = "inicio" } = options;

  if (containsAny(text, ["horario", "hora", "abierto", "cerráis", "abris", "cerrar"])) {
    return {
      intent: "horario",
      confidence: 0.98,
      requiresHuman: false,
      extractedData: {
        originalIntent: "horario",
        serviceType: "general",
        urgency: "baja",
        replyMode: "normal",
        source: "rules"
      }
    };
  }

  if (
    containsAny(text, [
      "ubicacion",
      "ubicación",
      "direccion",
      "dirección",
      "donde estais",
      "dónde estáis"
    ])
  ) {
    return {
      intent: "ubicacion",
      confidence: 0.98,
      requiresHuman: false,
      extractedData: {
        originalIntent: "ubicacion",
        serviceType: "general",
        urgency: "baja",
        replyMode: "normal",
        source: "rules"
      }
    };
  }

  if (
    containsAny(text, [
      "llamadme",
      "llamarme",
      "me podeis llamar",
      "me podéis llamar",
      "quiero que me llaméis"
    ])
  ) {
    return {
      intent: "contacto",
      confidence: 0.96,
      requiresHuman: false,
      extractedData: {
        originalIntent: "contacto",
        serviceType: "general",
        urgency: "media",
        replyMode: "normal",
        source: "rules",
        requestCall: true
      }
    };
  }

  const llmResult = await detectIntentWithLLM({
    message,
    channel,
    subject,
    currentStep
  });

  const mappedIntent = mapToAgentIntent(llmResult.intent);
  const confidence = normalizeConfidence(llmResult.confidence, 0);

  const requiresHuman =
    llmResult.intent === "unknown" ||
    llmResult.replyMode === "clarify" ||
    confidence < 0.55;

  return {
    intent: mappedIntent,
    confidence,
    requiresHuman,
    extractedData: {
      originalIntent: llmResult.intent || "unknown",
      serviceType: llmResult.serviceType || "unknown",
      urgency: llmResult.urgency || "unknown",
      replyMode: llmResult.replyMode || "clarify",
      source: llmResult.source || "fallback"
    }
  };
}

module.exports = {
  detect
};