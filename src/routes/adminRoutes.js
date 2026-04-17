const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

router.get("/sessions", adminController.getSessions);
router.get("/sessions/:sessionId/messages", adminController.getSessionMessages);

module.exports = router;