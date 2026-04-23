const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/email", verifyToken, aiController.analyzeEmail);
router.post("/call", verifyToken, aiController.analyzeCall);
router.post("/general", verifyToken, aiController.generalChat);

module.exports = router;
