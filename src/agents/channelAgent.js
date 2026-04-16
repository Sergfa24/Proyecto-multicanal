function format({ channel, text }) {
  switch (channel) {
    case "email":
      return `Hola,

${text}

Un saludo.`;

    case "whatsapp":
      return text;

    case "web":
      return text;

    case "call":
      return text;

    default:
      return text;
  }
}

module.exports = {
  format
};