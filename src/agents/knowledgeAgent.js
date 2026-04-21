const { generateReply } = require("../services/replyGenerationService");

async function getResponse({
  classification,
  channel,
  message,
  context = ""
}) {
  const serviceType = classification?.extractedData?.serviceType || "general";
  const urgency = classification?.extractedData?.urgency || "unknown";

  const fallbackText = getFallbackText(classification, serviceType, urgency);

  const aiReply = await generateReply({
    classification,
    channel,
    userMessage: message,
    context,
    companyName: "Fontical"
  });

  return {
    text: aiReply || fallbackText,
    actions: buildActions(classification)
  };
}

function buildActions(classification) {
  switch (classification.intent) {
    case "contacto":
      return ["create_contact_request"];
    case "solicitud_servicio":
      return ["create_service_request"];
    default:
      return [];
  }
}

function getFallbackText(classification, serviceType, urgency) {
  switch (classification.intent) {
    case "horario":
      return "Nuestro horario es de lunes a viernes. Si quieres, también puedo dejar registrada tu consulta para que te contacten.";

    case "ubicacion":
      return "Puedo ayudarte con la ubicación y los datos de contacto de la empresa. Si quieres, también puedo registrar tu consulta.";

    case "contacto":
      return "Perfecto, puedo dejar registrada tu solicitud de contacto para que el equipo te responda lo antes posible.";

    case "solicitud_servicio":
      return urgency === "alta"
        ? `He detectado una consulta relacionada con ${serviceType}. Parece importante, así que puedo dejar registrada la solicitud para que la revisen cuanto antes.`
        : `Puedo ayudarte con una solicitud relacionada con ${serviceType}. Si quieres, dejo registrada la petición para que te contacten con más detalle.`;

    case "materiales":
      return "Puedo ayudarte con consultas sobre materiales o repuestos. Si quieres, también puedo dejar registrada tu consulta.";

    case "productos":
      return "Puedo ayudarte con información sobre productos. Si quieres, también puedo registrar tu consulta.";

    case "menu":
      return "Puedo ayudarte con horario, ubicación, productos, materiales, servicios o solicitudes de contacto.";

    default:
      return "No he entendido del todo la consulta. Puedo ayudarte con horario, ubicación, contacto o servicios.";
  }
}

module.exports = {
  getResponse
};