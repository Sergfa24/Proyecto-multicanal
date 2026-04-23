const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getModel() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no configurada en .env");
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// POST /api/ai/email — Analizar un email con IA
const analyzeEmail = async (req, res) => {
  try {
    const { action, emailBody, emailSubject, emailFrom, userMessage } = req.body;

    if (!emailBody && !userMessage) {
      return res.status(400).json({ ok: false, error: "No hay contenido para analizar" });
    }

    const model = getModel();
    let prompt = "";

    const emailContext = emailBody
      ? `De: ${emailFrom || "Desconocido"}\nAsunto: ${emailSubject || "Sin asunto"}\n\nContenido del email:\n${stripHtml(emailBody)}`
      : "";

    switch (action) {
      case "summarize":
        prompt = `Eres un asistente de email profesional. Resume el siguiente correo de forma concisa en español, destacando los puntos clave y cualquier acción requerida.\n\n${emailContext}`;
        break;

      case "classify":
        prompt = `Eres un asistente de email profesional. Clasifica el siguiente correo en una o más categorías (Urgente, Trabajo, Personal, Promoción, Spam, Informativo, Requiere respuesta, Factura/Pago, Newsletter) y justifica brevemente tu clasificación en español.\n\n${emailContext}`;
        break;

      case "reply":
        prompt = `Eres un asistente de email profesional. Redacta una respuesta profesional y educada en español para el siguiente correo. La respuesta debe ser concisa y adecuada al contexto.\n\n${emailContext}`;
        break;

      case "chat":
        prompt = `Eres un asistente de email IA integrado en NexusAI. El usuario tiene un correo abierto y te hace una pregunta o petición. Responde en español de forma útil y concisa.\n\n${emailContext ? "Email actual:\n" + emailContext + "\n\n" : ""}Pregunta del usuario: ${userMessage}`;
        break;

      default:
        prompt = `Eres un asistente de email IA. Responde en español de forma útil.\n\n${emailContext ? "Email:\n" + emailContext + "\n\n" : ""}${userMessage || "Analiza este email."}`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI email:", err.message);
    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ ok: false, error: "API de IA no configurada. Añade GEMINI_API_KEY en el .env" });
    }
    res.status(500).json({ ok: false, error: "Error al procesar con IA" });
  }
};

// POST /api/ai/call — Analizar datos de una llamada con IA
const analyzeCall = async (req, res) => {
  try {
    const { action, callData, userMessage } = req.body;

    const model = getModel();
    let prompt = "";

    const callContext = callData
      ? `Datos de la llamada:\n- De: ${callData.from || "Desconocido"}\n- A: ${callData.to || "Desconocido"}\n- Duración: ${callData.duration || "N/A"}\n- Estado: ${callData.status || "N/A"}\n- Fecha: ${callData.date || "N/A"}${callData.transcription ? "\n- Transcripción: " + callData.transcription : ""}`
      : "";

    switch (action) {
      case "summarize":
        prompt = `Eres un asistente de telefonía IA. Resume la siguiente información de la llamada en español, destacando los puntos clave.\n\n${callContext}`;
        break;

      case "analyze":
        prompt = `Eres un asistente de telefonía IA. Analiza la siguiente llamada y proporciona insights útiles (sentimiento, temas principales, acciones sugeridas) en español.\n\n${callContext}`;
        break;

      case "chat":
        prompt = `Eres un asistente de telefonía IA integrado en NexusAI. El usuario te hace una pregunta sobre llamadas. Responde en español.\n\n${callContext ? callContext + "\n\n" : ""}Pregunta: ${userMessage}`;
        break;

      default:
        prompt = `Eres un asistente de telefonía IA. Responde en español.\n\n${callContext ? callContext + "\n\n" : ""}${userMessage || "Analiza esta llamada."}`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI call:", err.message);
    if (err.message.includes("GEMINI_API_KEY")) {
      return res.status(500).json({ ok: false, error: "API de IA no configurada. Añade GEMINI_API_KEY en el .env" });
    }
    res.status(500).json({ ok: false, error: "Error al procesar con IA" });
  }
};

// POST /api/ai/general — Chat general con IA
const generalChat = async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ ok: false, error: "Mensaje vacío" });
    }

    const model = getModel();
    const prompt = `Eres un asistente IA de NexusAI, una plataforma multicanal de comunicaciones. Responde en español de forma profesional y útil.\n\n${context ? "Contexto: " + context + "\n\n" : ""}Usuario: ${message}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI general:", err.message);
    res.status(500).json({ ok: false, error: "Error al procesar con IA" });
  }
};

// Helper: strip HTML tags for plain text context
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { analyzeEmail, analyzeCall, generalChat };
