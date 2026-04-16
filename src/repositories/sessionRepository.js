const db = require("../../db/database");

function getBySessionId(sessionId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM sessions WHERE sessionId = ?",
      [sessionId],
      (err, row) => {
        if (err) return reject(err);

        if (!row) return resolve(null);

        row.collectedData = safeParse(row.collectedData);
        resolve(row);
      }
    );
  });
}

function create({ sessionId, currentStep, collectedData }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO sessions (sessionId, currentStep, collectedData)
       VALUES (?, ?, ?)`,
      [sessionId, currentStep, JSON.stringify(collectedData || {})],
      function (err) {
        if (err) return reject(err);

        resolve({
          id: this.lastID,
          sessionId,
          currentStep,
          collectedData
        });
      }
    );
  });
}

function update(sessionId, { currentStep, collectedData }) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE sessions
       SET currentStep = ?, collectedData = ?
       WHERE sessionId = ?`,
      [currentStep, JSON.stringify(collectedData || {}), sessionId],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
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
  getBySessionId,
  create,
  update
};