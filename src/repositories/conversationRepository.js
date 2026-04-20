const db = require("../../db/database");

function getAllSessions() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        s.sessionId,
        s.currentStep,
        s.collectedData,
        MAX(m.id) as lastMessageId
      FROM sessions s
      LEFT JOIN messages m ON s.sessionId = m.sessionId
      GROUP BY s.sessionId, s.currentStep, s.collectedData
      ORDER BY lastMessageId DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);

      const parsedRows = rows.map((row) => ({
        ...row,
        collectedData: safeParse(row.collectedData)
      }));

      resolve(parsedRows);
    });
  });
}

function getMessagesBySessionId(sessionId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, sessionId, sender, message, detectedIntent, step
      FROM messages
      WHERE sessionId = ?
      ORDER BY id ASC
    `;

    db.all(sql, [sessionId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function safeParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

module.exports = {
  getAllSessions,
  getMessagesBySessionId
};