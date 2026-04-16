require("dotenv").config();
const express = require("express");

const inboundRoutes = require("./routes/inboundRoutes");
const healthRoutes = require("./routes/healthRoutes");

require("../db/database");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use("/api/health", healthRoutes);
app.use("/api/inbound", inboundRoutes);

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

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});