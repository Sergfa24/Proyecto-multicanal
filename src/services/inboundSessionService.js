const sessionRepository = require("../repositories/sessionRepository");

function buildSessionId(channel, userId) {
  return `${channel}:${userId}`;
}

async function getOrCreateSession(channel, userId) {
  const sessionId = buildSessionId(channel, userId);

  let session = await sessionRepository.getBySessionId(sessionId);

  if (!session) {
    session = await sessionRepository.create({
      sessionId,
      currentStep: "agent_entry",
      collectedData: {
        channel,
        userId
      }
    });
  }

  return session;
}

async function updateSession(channel, userId, data = {}) {
  const sessionId = buildSessionId(channel, userId);
  const existing = await sessionRepository.getBySessionId(sessionId);

  const currentCollectedData = existing?.collectedData || {};

  await sessionRepository.update(sessionId, {
    currentStep: data.currentStep || existing?.currentStep || "agent_entry",
    collectedData: {
      ...currentCollectedData,
      ...data.collectedData
    }
  });

  return sessionId;
}

module.exports = {
  buildSessionId,
  getOrCreateSession,
  updateSession
};