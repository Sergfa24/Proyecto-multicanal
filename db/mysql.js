const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "nexusai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(process.env.MYSQL_SSL === "true" ? {
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  } : {}),
});

async function initMySQL() {
  try {
    const conn = await pool.getConnection();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS gmail_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry DATETIME NOT NULL,
        gmail_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    conn.release();
    console.log("MySQL conectado — tablas users y gmail_tokens listas");
  } catch (err) {
    console.error("Error conectando con MySQL:", err.message);
    console.error("Asegúrate de que el servidor MySQL está corriendo y las credenciales en .env son correctas.");
    throw err;
  }
}

module.exports = { pool, initMySQL };
