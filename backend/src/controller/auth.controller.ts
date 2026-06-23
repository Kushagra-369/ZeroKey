import { Request, Response } from 'express';
import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../model/user.model';
import { Session } from '../model/session.model';
import { LoginHistory } from '../model/loginHistory.model';
import { RecoveryCode } from '../model/recoveryCode.model';
import { Device } from '../model/device.model';
import { successResponse, errorResponse } from '../utils/response';
import { encrypt } from '../utils/encrypt';
import { AuthRequest } from '../types';

// ==================== TYPES ====================
interface RegisterBody {
    email: string;
    name: string;
    password?: string;
}

interface LoginBody {
    email: string;
    password: string;
    deviceId?: string;
    deviceName?: string;
    os?: string;
    browser?: string;
}

interface RefreshBody {
    refreshToken: string;
}

interface VerifyBody {
    email: string;
    code: string;
}

interface ForgotBody {
    email: string;
}

interface ResetBody {
    token: string;
    newPassword: string;
}

// ==================== REGISTER ====================
export const register = async (req: Request<{}, {}, RegisterBody>, res: Response) => {
    try {
        const { email, name, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return errorResponse(res, 'User already exists', 400);
        }

        // Hash password if provided
        let hashedPassword: string | undefined;
        if (password) {
            const salt = await bcrypt.genSalt(12);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        // Create user - FIXED: password field properly handled
        const user = new User({
            email,
            name,
            password: hashedPassword,
            isPasswordless: !password,
            isVerified: true
        });
        await user.save();

        // Generate recovery codes
        const recoveryCodes: string[] = [];
        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(5).toString('hex').toUpperCase();
            recoveryCodes.push(code);

            const encrypted = encrypt(code);
            await RecoveryCode.create({
                userId: user._id,
                code: encrypted.encrypted,
                type: 'backup',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET!,
            {
                expiresIn: "15m",
            }
        );

        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET!,
            {
                expiresIn: "7d",
            }
        );

        // Create session
        await Session.create({
            userId: user._id,
            token,
            refreshToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            loginMethod: 'password',
            isActive: true
        });

        // Log login history
        await LoginHistory.create({
            userId: user._id,
            email: user.email,
            success: true,
            method: 'password',
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            isSuspicious: false
        });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name
                },
                token,
                refreshToken,
                recoveryCodes
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        return errorResponse(res, 'Registration failed', 500);
    }
};

// ==================== LOGIN ====================
export const login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
        const { email, password, deviceId, deviceName, os, browser } = req.body;

        // Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            await logFailedAttempt(email, req);
            return errorResponse(res, 'Invalid credentials', 401);
        }

        // Check if account is locked
        if (user.isLocked) {
            if (user.lockedUntil && new Date() < user.lockedUntil) {
                return errorResponse(res, `Account locked. Try after ${user.lockedUntil}`, 403);
            } else {
                user.isLocked = false;
                user.lockedUntil = null;
                user.failedLoginAttempts = 0;
                await user.save();
            }
        }

        // Check password
        if (!user.password) {
            await user.incrementLoginAttempts();
            await logFailedAttempt(email, req);
            return errorResponse(res, 'Invalid credentials', 401);
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            await user.incrementLoginAttempts();
            await logFailedAttempt(email, req);
            return errorResponse(res, 'Invalid credentials', 401);
        }

        // Reset login attempts on success
        await user.resetLoginAttempts();

        // Update last login
        user.lastLoginAt = new Date();
        user.lastLoginIP = req.ip || req.socket.remoteAddress || '';
        user.lastLoginDevice = req.get('user-agent') || '';
        await user.save();

        // Handle device
        let device = null;
        if (deviceId) {
            device = await Device.findOne({ deviceId, userId: user._id });

            if (!device) {
                const approvalToken = crypto.randomBytes(32).toString('hex');
                device = await Device.create({
                    userId: user._id,
                    deviceId,
                    deviceName: deviceName || 'Unknown Device',
                    deviceType: 'other',
                    os: os || 'Unknown',
                    browser: browser || 'Unknown',
                    ipAddress: req.ip || req.socket.remoteAddress || '',
                    userAgent: req.get('user-agent') || '',
                    fingerprint: req.get('user-agent') || '',
                    isTrusted: false,
                    isApproved: false,
                    approvalToken,
                    approvalTokenExpires: new Date(Date.now() + 10 * 60 * 1000),
                    lastLoginAt: new Date(),
                    lastLoginIP: req.ip || req.socket.remoteAddress || '',
                    loginCount: 1
                });
            } else {
                device.lastLoginAt = new Date();
                device.lastLoginIP = req.ip || req.socket.remoteAddress || '';
                device.loginCount += 1;
                await device.save();
            }
        }

        // Generate tokens
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET!,
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: "7d" }
        );

        // Create session
        // Agar device nahi hai toh deviceId field hi mat bhejo
        const sessionData: any = {
            userId: user._id,
            token,
            refreshToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            loginMethod: 'password',
            isActive: true
        };

        // ✅ Only add deviceId if device exists
        if (device) {
            sessionData.deviceId = device._id;
        }

        await Session.create(sessionData);

        // Log successful login
        const historyData: any = {
            userId: user._id,
            email: user.email,
            success: true,
            method: 'password',
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            isSuspicious: false
        };

        if (device) {
            historyData.deviceId = device.deviceId;
        }

        await LoginHistory.create(historyData);

        return successResponse(res, {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                securityScore: user.securityScore
            },
            token,
            refreshToken,
            device: device ? {
                isTrusted: device.isTrusted,
                isApproved: device.isApproved,
                requiresApproval: !device.isApproved
            } : null
        }, 'Login successful');

    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 'Login failed', 500);
    }
};

// ==================== LOGOUT ====================
export const logout = async (req: any, res: Response) => {
    try {
        const token = req.token;

        if (token) {
            await Session.findOneAndUpdate(
                { token },
                { isActive: false }
            );
        }

        return successResponse(res, null, 'Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
        return errorResponse(res, 'Logout failed', 500);
    }
};

// ==================== REFRESH TOKEN ====================
export const refreshToken = async (req: Request<{}, {}, RefreshBody>, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return errorResponse(res, 'Refresh token required', 400);
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };

        const session = await Session.findOne({
            refreshToken,
            userId: decoded.id,
            isActive: true
        });

        if (!session) {
            return errorResponse(res, 'Invalid refresh token', 401);
        }

        if (new Date() > session.refreshExpiresAt) {
            return errorResponse(res, 'Refresh token expired', 401);
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const newToken = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET!,
            {
                expiresIn: "15m"
            }
        );

        const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET!,
            {
                expiresIn: "7d" 
            }
        );

        session.token = newToken;
        session.refreshToken = newRefreshToken;
        session.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        session.refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await session.save();

        return successResponse(res, {
            token: newToken,
            refreshToken: newRefreshToken
        }, 'Tokens refreshed');

    } catch (error) {
        console.error('Refresh token error:', error);
        return errorResponse(res, 'Failed to refresh token', 500);
    }
};

// ==================== GET PROFILE ====================
export const getProfile = async (req: any, res: Response) => {
    try {
        const user = await User.findById(req.user?._id).select('-password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        return successResponse(res, { user }, 'Profile fetched');
    } catch (error) {
        console.error('Profile error:', error);
        return errorResponse(res, 'Failed to fetch profile', 500);
    }
};

// ==================== VERIFY EMAIL ====================
export const verifyEmail = async (req: Request<{}, {}, VerifyBody>, res: Response) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        user.isVerified = true;
        await user.save();

        return successResponse(res, null, 'Email verified successfully');
    } catch (error) {
        console.error('Verify email error:', error);
        return errorResponse(res, 'Verification failed', 500);
    }
};

// ==================== HELPERS ====================
const logFailedAttempt = async (email: string, req: Request) => {
    await LoginHistory.create({
        userId: new mongoose.Types.ObjectId(),
        email,
        success: false,
        method: 'password',
        ipAddress: req.ip || req.socket.remoteAddress || '',
        userAgent: req.get('user-agent') || '',
        failureReason: 'Invalid credentials',
        isSuspicious: true
    });
};