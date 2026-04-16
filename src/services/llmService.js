require("dotenv").config();
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

const ALLOWED_INTENTS = [
  "productos",
  "materiales",
  "instalaciones",
  "horario",
  "ubicacion",
  "contacto",
  "menu",
  "unknown"
];

const ALLOWED_SERVICE_TYPES = [
  "caldera",
  "calentador",
  "tuberia",
  "reparacion",
  "mantenimiento",
  "general",
  "unknown"
];

const ALLOWED_URGENCY = ["alta", "media", "baja", "unknown"];

async function detectIntentWithLLM({
  message,
  channel = "web",
  subject = "",
  currentStep = "inicio"
}) {
  try {
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Eres un clasificador de intención para un sistema de atención al cliente multicanal.

Devuelve SOLO JSON válido con este formato exacto:

{
  "intent": "productos | materiales | instalaciones | horario | ubicacion | contacto | menu | unknown",
  "serviceType": "caldera | calentador | tuberia | reparacion | mantenimiento | general | unknown",
  "urgency": "alta | media | baja | unknown",
  "confidence": 0.0,
  "replyMode": "normal | clarify"
}

Reglas:
- "materiales" = el usuario quiere comprar, consultar o pedir piezas, materiales, repuestos o stock.
- "instalaciones" = averías, fugas, reparaciones, montaje, mantenimiento o problemas técnicos.
- "contacto" = el usuario pide llamada, contacto, presupuesto o que le respondan.
- "urgency" será alta si hay fuga, rotura, avería grave o algo urgente.
- "replyMode" será "clarify" si el mensaje es ambiguo.
- No escribas nada fuera del JSON.
- Si no lo tienes claro usa "unknown".
`.trim()
        },
        {
          role: "user",
          content: JSON.stringify({
            channel,
            currentStep,
            subject,
            message
          })
        }
      ]
    });

    const raw = completion?.choices?.[0]?.message?.content?.trim();
    if (!raw) return fallbackResult();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fallbackResult();
    }

    const intent = ALLOWED_INTENTS.includes(parsed.intent) ? parsed.intent : "unknown";
    const serviceType = ALLOWED_SERVICE_TYPES.includes(parsed.serviceType)
      ? parsed.serviceType
      : "unknown";
    const urgency = ALLOWED_URGENCY.includes(parsed.urgency)
      ? parsed.urgency
      : "unknown";

    const parsedConfidence = Number(parsed.confidence);
    const confidence =
      !Number.isNaN(parsedConfidence) &&
      parsedConfidence >= 0 &&
      parsedConfidence <= 1
        ? parsedConfidence
        : 0;

    const replyMode =
      parsed.replyMode === "normal" || parsed.replyMode === "clarify"
        ? parsed.replyMode
        : "clarify";

    return {
      intent,
      serviceType,
      urgency,
      confidence,
      replyMode,
      source: "llm"
    };
  } catch (error) {
    console.error("Error en detectIntentWithLLM:", error?.message || error);
    return fallbackResult();
  }
}

function fallbackResult() {
  return {
    intent: "unknown",
    serviceType: "unknown",
    urgency: "unknown",
    confidence: 0,
    replyMode: "clarify",
    source: "fallback"
  };
}

module.exports = {
  detectIntentWithLLM
};