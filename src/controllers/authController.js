const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../../db/mysql");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: "Nombre, email y contraseña son obligatorios" });
    }

    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ ok: false, error: "Ya existe una cuenta con ese email" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, name, email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({
      ok: true,
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y contraseña son obligatorios" });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Credenciales incorrectas" });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ ok: false, error: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }

    const user = rows[0];

    const [tokens] = await pool.query(
      "SELECT gmail_email FROM gmail_tokens WHERE user_id = ?",
      [user.id]
    );

    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
        gmailConnected: tokens.length > 0,
        gmailEmail: tokens[0]?.gmail_email || null
      }
    });
  } catch (err) {
    console.error("Error en /me:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

module.exports = { register, login, me };
