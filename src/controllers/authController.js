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

const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: "El nombre es obligatorio" });
    }
    await pool.query("UPDATE users SET name = ? WHERE id = ?", [name.trim(), req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "Contraseña actual y nueva son obligatorias" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ ok: false, error: "Contraseña actual incorrecta" });

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error cambiando contraseña:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ ok: false, error: "Debes confirmar con tu contraseña" });
    }

    const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });

    await pool.query("DELETE FROM gmail_tokens WHERE user_id = ?", [req.user.id]);
    await pool.query("DELETE FROM users WHERE id = ?", [req.user.id]);

    res.json({ ok: true, message: "Cuenta eliminada correctamente" });
  } catch (err) {
    console.error("Error eliminando cuenta:", err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
};

module.exports = { register, login, me, updateProfile, changePassword, deleteAccount };
