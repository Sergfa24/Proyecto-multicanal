const express = require("express");
const router = express.Router();
const voiceController = require("../controllers/voiceController");

router.post("/token", voiceController.getToken);
router.post("/twiml", voiceController.handleTwiML);

module.exports = router;
