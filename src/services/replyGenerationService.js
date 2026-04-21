require("dotenv").config();
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

async function generateReply({
  classification,
  channel = "web",
  userMessage = "",
  context = "",
  companyName = "la empresa"
}) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("Falta OPENROUTER_API_KEY en .env");
      return null;
    }

    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Eres un asistente de atención al cliente de ${companyName}.

Tu tarea es redactar una respuesta breve, clara y útil para el cliente.

Debes devolver SOLO JSON válido con este formato exacto:

{
  "reply": "texto"
}

Reglas:
- No inventes datos concretos que no estén en la información recibida.
- Si falta información exacta, responde con prudencia y ofrece registrar la consulta.
- Si el canal es "whatsapp", escribe más corto y directo.
- Si el canal es "email", escribe más formal.
- Si la consulta parece urgente, transmite prioridad.
- No uses tecnicismos.
- No escribas nada fuera del JSON.
`.trim()
        },
        {
          role: "user",
          content: JSON.stringify({
            channel,
            intent: classification?.intent || "desconocido",
            extractedData: classification?.extractedData || {},
            userMessage,
            context
          })
        }
      ]
    });

    const raw = completion?.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      console.error("La IA no devolvió respuesta de texto");
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error("Error parseando JSON de reply generation:", raw);
      return null;
    }

    if (!parsed.reply || typeof parsed.reply !== "string") {
      return null;
    }

    return parsed.reply.trim();
  } catch (error) {
    console.error("Error en generateReply:", error?.message || error);
    return null;
  }
}

module.exports = {
  generateReply
};