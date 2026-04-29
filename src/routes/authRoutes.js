const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", verifyToken, authController.me);
router.put("/profile", verifyToken, authController.updateProfile);
router.put("/password", verifyToken, authController.changePassword);
router.delete("/delete", verifyToken, authController.deleteAccount);

module.exports = router;
