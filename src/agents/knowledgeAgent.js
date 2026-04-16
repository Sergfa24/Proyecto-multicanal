async function getResponse(classification) {
  switch (classification.intent) {
    case "horario":
      return {
        text: "Nuestro horario es de lunes a viernes. Si quieres, también puedo recoger tu consulta y hacer que te contacten.",
        actions: []
      };

    case "ubicacion":
      return {
        text: "Puedo ayudarte con la ubicación y los datos de contacto de la empresa. Si lo necesitas, también puedo registrar una solicitud para que te respondan directamente.",
        actions: []
      };

    case "contacto":
      return {
        text: "Perfecto, puedo dejar registrada tu solicitud de contacto para que el equipo te responda lo antes posible.",
        actions: ["create_contact_request"]
      };

    case "solicitud_servicio":
      return {
        text: "Sí, podemos ayudarte con ese tipo de servicio. Si quieres, puedo dejar registrada tu solicitud para que te contacten con más detalle.",
        actions: ["create_service_request"]
      };

    default:
      return {
        text: "No he entendido del todo la consulta. Puedo ayudarte con horario, ubicación, contacto o servicios.",
        actions: []
      };
  }
}

module.exports = {
  getResponse
};