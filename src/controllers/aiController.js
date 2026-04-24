const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Detect which AI provider is available (Gemini preferred, Groq fallback)
function getProvider() {
  if (GEMINI_API_KEY) return "gemini";
  if (GROQ_API_KEY) return "groq";
  throw new Error("No hay API de IA configurada. Añade GEMINI_API_KEY o GROQ_API_KEY en el .env");
}

// Unified AI call — works with Gemini or Groq transparently
async function generateAI(prompt) {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Groq (Llama 3.1 70B)
  const groq = new Groq({ apiKey: GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 2048,
  });
  return completion.choices[0]?.message?.content || "";
}

// POST /api/ai/email — Analizar un email con IA (single o con contexto semanal)
const analyzeEmail = async (req, res) => {
  try {
    const { action, emailBody, emailSubject, emailFrom, userMessage, weekEmails } = req.body;

    if (!emailBody && !userMessage && !weekEmails) {
      return res.status(400).json({ ok: false, error: "No hay contenido para analizar" });
    }

    let prompt = "";

    const emailContext = emailBody
      ? `De: ${emailFrom || "Desconocido"}\nAsunto: ${emailSubject || "Sin asunto"}\n\nContenido del email:\n${stripHtml(emailBody)}`
      : "";

    // Build week context from metadata (compact: ~50 tokens per email)
    let weekContext = "";
    if (weekEmails && weekEmails.length > 0) {
      weekContext = "EMAILS RECIENTES (" + weekEmails.length + "):\n" +
        weekEmails.map(function (e, i) {
          return (i + 1) + ". " + (e.unread ? "[NEW]" : "") + " " + (e.from || "").split("<")[0].trim() + " — " + (e.subject || "Sin asunto");
        }).join("\n");
    }

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

      case "week-summary":
        prompt = `Eres un asistente de email profesional e inteligente. El usuario quiere un resumen de sus emails de la semana. Analiza la siguiente lista y proporciona:
1. Un resumen general de la actividad (cuántos emails, cuántos sin leer)
2. Los correos más importantes o urgentes (máximo 5) con una breve explicación de por qué
3. Temas o hilos principales de la semana
4. Emails que probablemente requieran respuesta

Responde en español de forma organizada y concisa.\n\n${weekContext}`;
        break;

      case "week-important":
        prompt = `Eres un asistente de email profesional. Analiza estos emails de la semana y dime cuáles son los más importantes, ordenados por prioridad. Para cada uno, explica brevemente por qué es importante y si requiere acción. Responde en español.\n\n${weekContext}`;
        break;

      case "week-organize":
        prompt = `Eres un asistente de email profesional. Analiza estos emails de la semana y sugiere cómo organizarlos en carpetas/etiquetas. Para cada email, sugiere una etiqueta apropiada. Agrupa los que sean del mismo tema o remitente. Usa este formato para cada grupo:

ETIQUETA: [nombre de la etiqueta]
- Email #[número]: [asunto] (de: [remitente])

Responde en español.\n\n${weekContext}`;
        break;

      case "chat":
        prompt = `Eres un asistente de email IA integrado en NexusAI. Puedes analizar emails individuales y también tienes acceso al resumen de la bandeja semanal del usuario. Responde en español de forma útil y concisa.

${emailContext ? "Email actualmente abierto:\n" + emailContext + "\n\n" : ""}${weekContext ? weekContext + "\n\n" : ""}Pregunta del usuario: ${userMessage}`;
        break;

      default:
        prompt = `Eres un asistente de email IA. Responde en español de forma útil.\n\n${emailContext ? "Email:\n" + emailContext + "\n\n" : ""}${weekContext ? weekContext + "\n\n" : ""}${userMessage || "Analiza este email."}`;
    }

    const response = await generateAI(prompt);

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI email:", err.message);
    if (err.message.includes("No hay API de IA")) {
      return res.status(500).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: "Error al procesar con IA: " + err.message });
  }
};

// POST /api/ai/call — Analizar datos de una llamada con IA
const analyzeCall = async (req, res) => {
  try {
    const { action, callData, userMessage } = req.body;

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

    const response = await generateAI(prompt);

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI call:", err.message);
    if (err.message.includes("No hay API de IA")) {
      return res.status(500).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: "Error al procesar con IA: " + err.message });
  }
};

// POST /api/ai/general — Chat general con IA
const generalChat = async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ ok: false, error: "Mensaje vacío" });
    }

    const prompt = `Eres un asistente IA de NexusAI, una plataforma multicanal de comunicaciones. Responde en español de forma profesional y útil.\n\n${context ? "Contexto: " + context + "\n\n" : ""}Usuario: ${message}`;

    const response = await generateAI(prompt);

    res.json({ ok: true, response });
  } catch (err) {
    console.error("Error en AI general:", err.message);
    res.status(500).json({ ok: false, error: "Error al procesar con IA: " + err.message });
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

// POST /api/ai/organize — La IA organiza emails: crea labels y mueve correos
const organizeEmails = async (req, res) => {
  try {
    const { weekEmails } = req.body;
    if (!weekEmails || weekEmails.length === 0) {
      return res.status(400).json({ ok: false, error: "No hay emails para organizar" });
    }

    // Step 1: Ask AI to return structured JSON with label assignments
    const emailList = weekEmails.map((e, i) =>
      `${i + 1}. id:"${e.id}" | De: ${e.from} | Asunto: ${e.subject} | Preview: ${(e.snippet || "").substring(0, 80)}`
    ).join("\n");

    const prompt = `Eres un asistente de email experto en organización. Analiza estos emails y organízalos en carpetas lógicas.

REGLAS:
- Crea entre 3 y 8 etiquetas máximo
- Nombres de etiqueta cortos y claros en español (ej: "Trabajo", "Facturas", "Newsletters", "Personal", "Promociones", "Notificaciones")
- Cada email debe ir a exactamente una etiqueta
- Responde SOLO con JSON válido, sin texto adicional ni markdown

FORMATO DE RESPUESTA (JSON puro):
{
  "labels": [
    {
      "name": "NombreEtiqueta",
      "emailIds": ["id1", "id2"]
    }
  ],
  "summary": "Breve resumen de la organización realizada"
}

EMAILS:
${emailList}`;

    let responseText = (await generateAI(prompt)).trim();

    // Clean markdown code blocks if Gemini wraps the JSON
    responseText = responseText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let plan;
    try {
      plan = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("AI returned invalid JSON:", responseText);
      return res.json({
        ok: true,
        executed: false,
        response: "La IA ha analizado tus correos pero no pudo generar un plan estructurado. Intenta de nuevo o pídeme que los organice manualmente.",
        raw: responseText,
      });
    }

    // Return the plan for frontend to execute (frontend calls /api/gmail/labels and /api/gmail/move)
    res.json({
      ok: true,
      executed: false,
      plan: plan.labels || [],
      summary: plan.summary || "Organización lista para aplicar.",
      emailCount: weekEmails.length,
    });
  } catch (err) {
    console.error("Error en AI organize:", err.message);
    if (err.message.includes("No hay API de IA")) {
      return res.status(500).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: "Error al organizar con IA: " + err.message });
  }
};

module.exports = { analyzeEmail, analyzeCall, generalChat, organizeEmails };
