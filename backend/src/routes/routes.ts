import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimit.middleware";

// Auth Controller
import {
    register,
    login,
    logout,
    refreshToken,
    getProfile,
    verifyEmail,
} from "../controller/auth.controller";

// User Controller
import {
    getAllUsers,
    getUserById,
    updateProfile,
    changePassword,
    deleteAccount,
    getUserSessions,
    revokeSession,
    revokeAllSessions,
    getUserDevices,
    removeDevice,
    getSecurityAlerts,
    markAlertRead,
    markAllAlertsRead,
    getSecurityScore,
    getLoginHistory,
    updatePreferences
} from "../controller/user.controller";

// Vault Controller
import {
    getVault,
    addEntry,
    getEntryById,
    updateEntry,
    deleteEntry,
    searchEntries,
    getByCategory,
    getFavorites,
    generatePassword
} from "../controller/vault.controller";

// Device Controller
import {
    getDevices,
    getDeviceById,
    trustDevice,
    untrustDevice,
    approveDevice,
    rejectDevice,
    removeDevice as removeDeviceCtrl,
    generateApprovalToken
} from "../controller/device.controller";

// Biometric Controller
import {
    registerFace,
    verifyFace,
    registerHand,
    verifyHand,
    registerGesture,
    verifyGesture,
    getBiometricStatus,
    deleteBiometricData,
    livenessCheck,
    getGestureChallenge
} from "../controller/biometric.controller";

const router = express.Router();

// ==================== AUTH ROUTES (Public) ====================
router.post("/auth/register", rateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }), register);
router.post("/auth/login", rateLimiter({ windowMs: 5 * 60 * 1000, max: 5 }), login);
router.post("/auth/logout", authenticate, logout);
router.post("/auth/refresh", refreshToken);
router.post("/auth/verify-email", verifyEmail);
router.get("/auth/profile", authenticate, getProfile);

// ==================== USER ROUTES (Protected) ====================
router.get("/users", authenticate, getAllUsers);
router.get("/users/:id", authenticate, getUserById);
router.put("/users/profile", authenticate, updateProfile);
router.post("/users/change-password", authenticate, changePassword);
router.delete("/users/account", authenticate, deleteAccount);

// User Sessions
router.get("/users/sessions", authenticate, getUserSessions);
router.delete("/users/sessions/:sessionId", authenticate, revokeSession);
router.delete("/users/sessions", authenticate, revokeAllSessions);

// User Devices
router.get("/users/devices", authenticate, getUserDevices);
router.delete("/users/devices/:deviceId", authenticate, removeDevice);

// User Alerts
router.get("/users/alerts", authenticate, getSecurityAlerts);
router.put("/users/alerts/:alertId/read", authenticate, markAlertRead);
router.put("/users/alerts/read-all", authenticate, markAllAlertsRead);

// User Security
router.get("/users/security-score", authenticate, getSecurityScore);
router.get("/users/login-history", authenticate, getLoginHistory);
router.put("/users/preferences", authenticate, updatePreferences);

// ==================== VAULT ROUTES (Protected) ====================
router.get("/vault", authenticate, getVault);
router.post("/vault/entries", authenticate, addEntry);
router.get("/vault/entries/:entryId", authenticate, getEntryById);
router.put("/vault/entries/:entryId", authenticate, updateEntry);
router.delete("/vault/entries/:entryId", authenticate, deleteEntry);
router.get("/vault/search", authenticate, searchEntries);
router.get("/vault/category/:category", authenticate, getByCategory);
router.get("/vault/favorites", authenticate, getFavorites);
router.post("/vault/generate-password", authenticate, generatePassword);

// ==================== DEVICE ROUTES (Protected) ====================
router.get("/devices", authenticate, getDevices);
router.get("/devices/:deviceId", authenticate, getDeviceById);
router.put("/devices/:deviceId/trust", authenticate, trustDevice);
router.put("/devices/:deviceId/untrust", authenticate, untrustDevice);
router.post("/devices/:deviceId/approve", authenticate, approveDevice);
router.delete("/devices/:deviceId/reject", authenticate, rejectDevice);
router.delete("/devices/:deviceId", authenticate, removeDeviceCtrl);
router.post("/devices/:deviceId/generate-token", authenticate, generateApprovalToken);

// ==================== BIOMETRIC ROUTES (Protected) ====================
// Face
router.post("/biometric/face/register", authenticate, registerFace);
router.post("/biometric/face/verify", authenticate, verifyFace);

// Hand
router.post("/biometric/hand/register", authenticate, registerHand);
router.post("/biometric/hand/verify", authenticate, verifyHand);

// Gesture
router.post("/biometric/gesture/register", authenticate, registerGesture);
router.post("/biometric/gesture/verify", authenticate, verifyGesture);

// General
router.get("/biometric/status", authenticate, getBiometricStatus);
router.delete("/biometric/:type", authenticate, deleteBiometricData);
router.post("/biometric/liveness", authenticate, livenessCheck);
router.get("/biometric/gesture-challenge", authenticate, getGestureChallenge);

// ==================== HEALTH CHECK ====================
router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString()
    });
});

export default router;