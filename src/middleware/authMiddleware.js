const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "nexusai_default_secret_change_me";

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromCookie = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("token="))
    ?.split("=")[1];

  const token = authHeader?.split(" ")[1] || tokenFromCookie;

  if (!token) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Token inválido o expirado" });
  }
}

module.exports = { verifyToken, JWT_SECRET };
