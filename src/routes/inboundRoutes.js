const express = require("express");
const router = express.Router();
const inboundController = require("../controllers/inboundController");

router.post("/", inboundController.handleInbound);

module.exports = router;