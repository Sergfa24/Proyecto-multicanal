const db = require("../../db/database");

function create({ nombre, telefono, consulta }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO contactos (nombre, telefono, consulta)
       VALUES (?, ?, ?)`,
      [nombre, telefono, consulta],
      function (err) {
        if (err) return reject(err);

        resolve({
          id: this.lastID,
          nombre,
          telefono,
          consulta
        });
      }
    );
  });
}

function getAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM contactos ORDER BY id DESC`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  create,
  getAll
};