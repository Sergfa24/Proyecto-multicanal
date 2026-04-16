const contactRepository = require("../repositories/contactRepository");

async function execute({ classification, message, userId, channel }) {
  const actionsExecuted = [];

  if (classification.intent === "contacto") {
    await contactRepository.create({
      nombre: `Usuario ${userId}`,
      telefono: channel === "whatsapp" ? userId : "No indicado",
      consulta: `Solicitud automática de contacto. Mensaje original: ${message}`
    });

    actionsExecuted.push("contact_request_saved");
  }

  if (classification.intent === "solicitud_servicio") {
    await contactRepository.create({
      nombre: `Usuario ${userId}`,
      telefono: channel === "whatsapp" ? userId : "No indicado",
      consulta: `Solicitud de servicio registrada automáticamente. Mensaje original: ${message}`
    });

    actionsExecuted.push("service_request_saved");
  }

  if (classification?.extractedData?.requestCall) {
    await contactRepository.create({
      nombre: `Usuario ${userId}`,
      telefono: channel === "whatsapp" ? userId : "No indicado",
      consulta: `Solicitud automática de llamada. Mensaje original: ${message}`
    });

    actionsExecuted.push("call_request_saved");
  }

  return actionsExecuted;
}

module.exports = {
  execute
};