const db = require("../../db/database");

function create({ sessionId, sender, message, detectedIntent, step }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO messages (sessionId, sender, message, detectedIntent, step)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, sender, message, detectedIntent, step],
      function (err) {
        if (err) return reject(err);

        resolve({
          id: this.lastID,
          sessionId,
          sender,
          message
        });
      }
    );
  });
}

function getBySessionId(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM messages WHERE sessionId = ? ORDER BY id ASC`,
      [sessionId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

module.exports = {
  create,
  getBySessionId
};