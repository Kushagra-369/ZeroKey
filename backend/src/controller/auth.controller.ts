import { Request, Response } from 'express';
import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { User } from '../model/user.model';
import { Session } from '../model/session.model';
import { LoginHistory } from '../model/loginHistory.model';
import { RecoveryCode } from '../model/recoveryCode.model';
import { Device } from '../model/device.model';
import { successResponse, errorResponse } from '../utils/response';
import { encrypt } from '../utils/encrypt';
import { AuthRequest } from '../types';
import dotenv from "dotenv";
dotenv.config();

// ==================== OTP STORE ====================
const otpStore = new Map<string, { otp: string, expiresAt: Date }>();

// ==================== EMAIL CONFIG ====================
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ==================== SEND OTP EMAIL ====================
const sendOTPEmail = async (email: string, otp: string, isNewUser: boolean) => {
    const subject = isNewUser ? 'Welcome to ZEROKEY! Verify Your Email' : 'ZEROKEY Login Verification Code';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a2e; border-radius: 12px; color: #fff;">
            <div style="text-align: center; padding: 20px 0;">
                <h1 style="font-size: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🔐 ZEROKEY</h1>
                <p style="color: #a0aec0; font-size: 16px;">${isNewUser ? 'Welcome to the future of passwordless authentication!' : 'Your secure login verification code'}</p>
            </div>
            <div style="background: #16213e; padding: 30px; border-radius: 8px; text-align: center;">
                <p style="color: #e2e8f0; font-size: 18px;">Your verification code is:</p>
                <div style="font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #667eea; padding: 20px 0;">${otp}</div>
                <p style="color: #a0aec0; font-size: 14px;">This code will expire in 5 minutes.</p>
            </div>
            <div style="text-align: center; padding: 20px 0; color: #718096; font-size: 12px;">
                <p>If you didn't request this, please ignore this email.</p>
                <p>© 2024 ZEROKEY - Passwordless Authentication</p>
            </div>
        </div>
    `;

    await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@zerokey.com',
        to: email,
        subject,
        html,
    });
};

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

interface OTPVerifyBody {
    email: string;
    otp: string;
    name?: string;
    deviceId?: string;
    deviceName?: string;
    os?: string;
    browser?: string;
}

// ==================== SEND OTP ====================
export const sendOTP = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return errorResponse(res, 'Email is required', 400);
        }

        // Check if user exists
        const user = await User.findOne({ email });
        const isNewUser = !user;

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with expiry (5 minutes)
        otpStore.set(email, {
            otp,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        // Send OTP email
        await sendOTPEmail(email, otp, isNewUser);

        return successResponse(res, {
            isNewUser,
            message: isNewUser ? 'OTP sent for registration' : 'OTP sent for login'
        }, 'OTP sent successfully');

    } catch (error) {
        console.error('Send OTP error:', error);
        return errorResponse(res, 'Failed to send OTP', 500);
    }
};

// ==================== VERIFY OTP ====================
export const verifyOTP = async (req: Request<{}, {}, OTPVerifyBody>, res: Response) => {
    try {
        const { email, otp, name, deviceId, deviceName, os, browser } = req.body;

        if (!email || !otp) {
            return errorResponse(res, 'Email and OTP are required', 400);
        }

        // Check OTP in store
        const storedData = otpStore.get(email);
        if (!storedData) {
            return errorResponse(res, 'OTP expired or not found', 400);
        }

        if (storedData.otp !== otp) {
            return errorResponse(res, 'Invalid OTP', 400);
        }

        if (new Date() > storedData.expiresAt) {
            otpStore.delete(email);
            return errorResponse(res, 'OTP expired', 400);
        }

        // OTP verified - delete from store
        otpStore.delete(email);

        // Check if user exists
        let user = await User.findOne({ email });

        if (!user) {
            // New user - create account
            if (!name) {
                return errorResponse(res, 'Name is required for new user registration', 400);
            }

            user = new User({
                email,
                name,
                isPasswordless: true,
                isVerified: true,
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

            // Store recovery codes temporarily to show once
            res.locals.recoveryCodes = recoveryCodes;
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

        // Create session
        const sessionData: any = {
            userId: user._id,
            token,
            refreshToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            loginMethod: 'otp',
            isActive: true
        };

        if (device) {
            sessionData.deviceId = device._id;
        }

        await Session.create(sessionData);

        // Log login history
        const historyData: any = {
            userId: user._id,
            email: user.email,
            success: true,
            method: 'otp',
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            isSuspicious: false
        };

        if (device) {
            historyData.deviceId = device.deviceId;
        }

        await LoginHistory.create(historyData);

        // Update last login
        user.lastLoginAt = new Date();
        user.lastLoginIP = req.ip || req.socket.remoteAddress || '';
        user.lastLoginDevice = req.get('user-agent') || '';
        await user.save();

        const responseData: any = {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                securityScore: user.securityScore,
                isNewUser: !user.createdAt || user.createdAt.getTime() === user.updatedAt?.getTime(),
            },
            token,
            refreshToken,
            device: device ? {
                isTrusted: device.isTrusted,
                isApproved: device.isApproved,
                requiresApproval: !device.isApproved
            } : null
        };

        // Include recovery codes for new users
        if (res.locals.recoveryCodes) {
            responseData.recoveryCodes = res.locals.recoveryCodes;
        }

        return successResponse(res, responseData, 'OTP verified successfully');

    } catch (error) {
        console.error('Verify OTP error:', error);
        return errorResponse(res, 'Failed to verify OTP', 500);
    }
};

// ==================== CHECK USER EXISTS ====================
export const checkUser = async (req: Request, res: Response) => { 
    try {
        const { email } = req.body;
 
        if (!email) {
            return errorResponse(res, 'Email is required', 400);
        }

        const user = await User.findOne({ email });
        
        return successResponse(res, {
            exists: !!user,
            email: email,
            isNewUser: !user
        }, 'User check completed');
    } catch (error) {
        console.error('Check user error:', error);
        return errorResponse(res, 'Failed to check user', 500);
    }
};

// ==================== REGISTER ====================
export const register = async (req: Request<{}, {}, RegisterBody>, res: Response) => {
    try {
        const { email, name, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return errorResponse(res, 'User already exists', 400);
        }

        let hashedPassword: string | undefined;
        if (password) {
            const salt = await bcrypt.genSalt(12);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        const user = new User({
            email,
            name,
            password: hashedPassword,
            isPasswordless: !password,
            isVerified: true
        });
        await user.save();

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

// ==================== LOGIN (Password-based - legacy) ====================
export const login = async (req: Request<{}, {}, LoginBody>, res: Response) => {
    try {
        const { email, password, deviceId, deviceName, os, browser } = req.body;

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            await logFailedAttempt(email, req);
            return errorResponse(res, 'Invalid credentials', 401);
        }

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

        await user.resetLoginAttempts();

        user.lastLoginAt = new Date();
        user.lastLoginIP = req.ip || req.socket.remoteAddress || '';
        user.lastLoginDevice = req.get('user-agent') || '';
        await user.save();

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

        if (device) {
            sessionData.deviceId = device._id;
        }

        await Session.create(sessionData);

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
export const logout = async (req: AuthRequest, res: Response) => {
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
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: "7d" }
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
export const getProfile = async (req: AuthRequest, res: Response) => {
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