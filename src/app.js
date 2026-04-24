require("dotenv").config();
const express = require("express");

const inboundRoutes = require("./routes/inboundRoutes");
const healthRoutes = require("./routes/healthRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { initMySQL } = require("../db/mysql");

require("../db/database");

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.static("public"));

app.use("/api/health", healthRoutes);
app.use("/api/inbound", inboundRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/ai", aiRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada"
  });
});

app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({
    ok: false,
    error: "Error interno del servidor"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  await initMySQL();
});