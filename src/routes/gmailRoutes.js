const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmailController");
const { verifyToken } = require("../middleware/authMiddleware");

// OAuth2 flow
router.get("/auth", verifyToken, gmailController.authUrl);
router.get("/callback", gmailController.callback);

// Gmail operations (todas protegidas con JWT)
router.get("/status", verifyToken, gmailController.status);
router.get("/messages", verifyToken, gmailController.listMessages);
router.get("/messages/:id", verifyToken, gmailController.getMessage);
router.post("/send", verifyToken, gmailController.sendMessage);
router.post("/star/:id", verifyToken, gmailController.toggleStar);
router.get("/week", verifyToken, gmailController.getWeekEmails);
router.get("/labels", verifyToken, gmailController.listLabels);
router.post("/labels", verifyToken, gmailController.createLabel);
router.post("/move", verifyToken, gmailController.moveToLabel);
router.delete("/disconnect", verifyToken, gmailController.disconnect);

module.exports = router;
