const messageRepository = require("../repositories/messageRepository");

async function getRecentMessages(sessionId, limit = 5) {
  const messages = await messageRepository.getBySessionId(sessionId);
  return messages.slice(-limit);
}

function buildContextString(messages = []) {
  return messages
    .map((msg) => {
      const sender = msg.sender === "user" ? "Usuario" : "Sistema";
      return `${sender}: ${msg.message}`;
    })
    .join("\n");
}

module.exports = {
  getRecentMessages,
  buildContextString
};