const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET no está definido en las variables de entorno. Configúralo en el .env");
  process.exit(1);
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromCookie = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("token="))
    ?.split("=").slice(1).join("=");

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
