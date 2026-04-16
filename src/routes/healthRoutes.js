const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "fontical-ai-agents",
    status: "up"
  });
});

module.exports = router;