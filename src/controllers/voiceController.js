/*
  Voice Controller — Twilio Voice SDK Token Generation

  Required env vars:
    TWILIO_ACCOUNT_SID   — Your Twilio Account SID
    TWILIO_AUTH_TOKEN     — Your Twilio Auth Token
    TWILIO_API_KEY        — Twilio API Key SID
    TWILIO_API_SECRET     — Twilio API Key Secret
    TWILIO_TWIML_APP_SID  — TwiML App SID
    TWILIO_PHONE_NUMBER   — Your Twilio phone number (e.g. +1234567890)
*/

let twilioAvailable = false;
let AccessToken, VoiceGrant, VoiceResponse;

try {
  const twilio = require("twilio");
  AccessToken = twilio.jwt.AccessToken;
  VoiceGrant = AccessToken.VoiceGrant;
  VoiceResponse = twilio.twiml.VoiceResponse;
  twilioAvailable = true;
} catch (e) {
  console.warn("Twilio SDK not installed. Voice features will run in demo mode.");
  console.warn("Install with: npm install twilio");
}

async function getToken(req, res) {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: "phoneNumber is required" });
    }

    if (!twilioAvailable) {
      return res.json({
        ok: true,
        token: "DEMO_TOKEN",
        mode: "demo",
        message: "Twilio SDK not installed. Running in demo mode."
      });
    }

    const accountSid  = process.env.TWILIO_ACCOUNT_SID;
    const apiKey       = process.env.TWILIO_API_KEY;
    const apiSecret    = process.env.TWILIO_API_SECRET;
    const twimlAppSid  = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return res.json({
        ok: true,
        token: "DEMO_TOKEN",
        mode: "demo",
        message: "Twilio credentials not configured. Running in demo mode."
      });
    }

    const identity = phoneNumber.replace(/[^a-zA-Z0-9]/g, "_");

    const accessToken = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    });

    accessToken.addGrant(voiceGrant);

    return res.json({
      ok: true,
      token: accessToken.toJwt(),
      identity: identity,
      mode: "live"
    });
  } catch (error) {
    console.error("Error generating voice token:", error);
    return res.status(500).json({ ok: false, error: "Error generating token" });
  }
}

async function handleTwiML(req, res) {
  if (!twilioAvailable) {
    return res.type("text/xml").send("<Response><Say>Demo mode</Say></Response>");
  }

  const twiml = new VoiceResponse();
  const to = req.body.To || "";

  if (to) {
    const dial = twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER || "" });
    dial.number(to);
  } else {
    twiml.say({ language: "es-ES" }, "No se ha indicado un número de destino.");
  }

  res.type("text/xml");
  res.send(twiml.toString());
}

module.exports = {
  getToken,
  handleTwiML
};
