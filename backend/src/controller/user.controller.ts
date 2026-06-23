import { Response } from 'express';
import { User } from '../model/user.model';
import { Session } from '../model/session.model';
import { Device } from '../model/device.model';
import { LoginHistory } from '../model/loginHistory.model';
import { SecurityAlert } from '../model/securityAlert.model';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// ==================== GET ALL USERS (Admin only) ====================
export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments();

        return successResponse(res, {
            users,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        }, 'Users fetched successfully');
    } catch (error) {
        console.error('Get all users error:', error);
        return errorResponse(res, 'Failed to fetch users', 500);
    }
};

// ==================== GET USER BY ID ====================
export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // ✅ FIX: Type assertion or check karo pehle
        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return errorResponse(res, 'Invalid user ID', 400);
        }

        const user = await User.findById(id).select('-password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        return successResponse(res, { user }, 'User fetched successfully');
    } catch (error) {
        console.error('Get user error:', error);
        return errorResponse(res, 'Failed to fetch user', 500);
    }
};

// ==================== UPDATE PROFILE ====================
export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { name, email, preferences } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (preferences) {
            user.preferences = {
                ...user.preferences,
                ...preferences
            };
        }

        await user.save();

        return successResponse(res, {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                preferences: user.preferences
            }
        }, 'Profile updated successfully');
    } catch (error) {
        console.error('Update profile error:', error);
        return errorResponse(res, 'Failed to update profile', 500);
    }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { currentPassword, newPassword } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!currentPassword || !newPassword) {
            return errorResponse(res, 'Current password and new password required', 400);
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            return errorResponse(res, 'Current password is incorrect', 401);
        }

        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        await Session.updateMany(
            { userId: user._id, isActive: true },
            { isActive: false }
        );

        return successResponse(res, null, 'Password changed successfully. Please login again.');
    } catch (error) {
        console.error('Change password error:', error);
        return errorResponse(res, 'Failed to change password', 500);
    }
};

// ==================== DELETE ACCOUNT ====================
export const deleteAccount = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { password } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const isValid = await user.comparePassword(password);
        if (!isValid) {
            return errorResponse(res, 'Invalid password', 401);
        }

        await Promise.all([
            User.findByIdAndDelete(userId),
            Session.deleteMany({ userId }),
            Device.deleteMany({ userId }),
            LoginHistory.deleteMany({ userId }),
            SecurityAlert.deleteMany({ userId })
        ]);

        return successResponse(res, null, 'Account deleted successfully');
    } catch (error) {
        console.error('Delete account error:', error);
        return errorResponse(res, 'Failed to delete account', 500);
    }
};

// ==================== GET USER SESSIONS ====================
export const getUserSessions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const sessions = await Session.find({ userId, isActive: true })
            .populate('deviceId', 'deviceName deviceType os browser')
            .sort({ lastActivityAt: -1 });

        return successResponse(res, { sessions }, 'Sessions fetched successfully');
    } catch (error) {
        console.error('Get sessions error:', error);
        return errorResponse(res, 'Failed to fetch sessions', 500);
    }
};

// ==================== REVOKE SESSION ====================
export const revokeSession = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { sessionId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        // ✅ FIX: Check if sessionId exists and is string
        if (!sessionId || typeof sessionId !== 'string') {
            return errorResponse(res, 'Session ID required', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return errorResponse(res, 'Invalid session ID', 400);
        }

        const session = await Session.findOne({ 
            _id: new mongoose.Types.ObjectId(sessionId), 
            userId 
        });
        
        if (!session) {
            return errorResponse(res, 'Session not found', 404);
        }

        session.isActive = false;
        await session.save();

        return successResponse(res, null, 'Session revoked successfully');
    } catch (error) {
        console.error('Revoke session error:', error);
        return errorResponse(res, 'Failed to revoke session', 500);
    }
};

// ==================== REVOKE ALL SESSIONS ====================
export const revokeAllSessions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        await Session.updateMany(
            { userId, isActive: true },
            { isActive: false }
        );

        return successResponse(res, null, 'All sessions revoked successfully');
    } catch (error) {
        console.error('Revoke all sessions error:', error);
        return errorResponse(res, 'Failed to revoke sessions', 500);
    }
};

// ==================== GET USER DEVICES ====================
export const getUserDevices = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const devices = await Device.find({ userId })
            .sort({ lastLoginAt: -1 });

        return successResponse(res, { devices }, 'Devices fetched successfully');
    } catch (error) {
        console.error('Get devices error:', error);
        return errorResponse(res, 'Failed to fetch devices', 500);
    }
};

// ==================== REMOVE DEVICE ====================
export const removeDevice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        // ✅ FIX
        if (!deviceId || typeof deviceId !== 'string') {
            return errorResponse(res, 'Device ID required', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(deviceId)) {
            return errorResponse(res, 'Invalid device ID', 400);
        }

        const device = await Device.findOne({ 
            _id: new mongoose.Types.ObjectId(deviceId), 
            userId 
        });
        
        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        await Device.findByIdAndDelete(deviceId);
        await Session.updateMany(
            { deviceId, isActive: true },
            { isActive: false }
        );

        return successResponse(res, null, 'Device removed successfully');
    } catch (error) {
        console.error('Remove device error:', error);
        return errorResponse(res, 'Failed to remove device', 500);
    }
};

// ==================== GET SECURITY ALERTS ====================
export const getSecurityAlerts = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const limit = parseInt(req.query.limit as string) || 50;

        const alerts = await SecurityAlert.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit);

        const unreadCount = await SecurityAlert.countDocuments({
            userId,
            isRead: false
        });

        return successResponse(res, {
            alerts,
            unreadCount
        }, 'Security alerts fetched successfully');
    } catch (error) {
        console.error('Get alerts error:', error);
        return errorResponse(res, 'Failed to fetch alerts', 500);
    }
};

// ==================== MARK ALERT AS READ ====================
export const markAlertRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { alertId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        // ✅ FIX
        if (!alertId || typeof alertId !== 'string') {
            return errorResponse(res, 'Alert ID required', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(alertId)) {
            return errorResponse(res, 'Invalid alert ID', 400);
        }

        const alert = await SecurityAlert.findOne({ 
            _id: new mongoose.Types.ObjectId(alertId), 
            userId 
        });
        
        if (!alert) {
            return errorResponse(res, 'Alert not found', 404);
        }

        alert.isRead = true;
        await alert.save();

        return successResponse(res, null, 'Alert marked as read');
    } catch (error) {
        console.error('Mark alert read error:', error);
        return errorResponse(res, 'Failed to mark alert as read', 500);
    }
};

// ==================== MARK ALL ALERTS AS READ ====================
export const markAllAlertsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        await SecurityAlert.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        return successResponse(res, null, 'All alerts marked as read');
    } catch (error) {
        console.error('Mark all alerts read error:', error);
        return errorResponse(res, 'Failed to mark alerts as read', 500);
    }
};

// ==================== GET SECURITY SCORE ====================
export const getSecurityScore = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        const breakdown = {
            passwordStrength: 0,
            twoFactorEnabled: 0,
            devicesTrusted: 0,
            recentActivity: 0,
            accountAge: 0
        };

        if (user.password) {
            const hasPassword = !!user.password;
            const isLong = user.password.length > 12;
            breakdown.passwordStrength = hasPassword && isLong ? 20 : 10;
        }

        breakdown.twoFactorEnabled = user.twoFactorEnabled ? 20 : 0;

        const trustedDevices = await Device.countDocuments({ userId, isTrusted: true });
        breakdown.devicesTrusted = Math.min(trustedDevices * 5, 20);

        if (user.lastLoginAt) {
            const daysSinceLogin = Math.floor((Date.now() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24));
            breakdown.recentActivity = daysSinceLogin < 7 ? 20 : daysSinceLogin < 30 ? 10 : 0;
        }

        if (user.createdAt) {
            const daysSinceCreation = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            breakdown.accountAge = daysSinceCreation > 30 ? 20 : 10;
        }

        const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

        user.securityScore = total;
        await user.save();

        return successResponse(res, {
            score: total,
            breakdown,
            maxScore: 100
        }, 'Security score fetched');
    } catch (error) {
        console.error('Get security score error:', error);
        return errorResponse(res, 'Failed to fetch security score', 500);
    }
};

// ==================== GET LOGIN HISTORY ====================
export const getLoginHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const history = await LoginHistory.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await LoginHistory.countDocuments({ userId });

        return successResponse(res, {
            history,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        }, 'Login history fetched');
    } catch (error) {
        console.error('Get login history error:', error);
        return errorResponse(res, 'Failed to fetch login history', 500);
    }
};

// ==================== UPDATE PREFERENCES ====================
export const updatePreferences = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { theme, autoLogoutMinutes, language } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        user.preferences = {
            theme: theme || user.preferences.theme,
            autoLogoutMinutes: autoLogoutMinutes || user.preferences.autoLogoutMinutes,
            language: language || user.preferences.language
        };

        await user.save();

        return successResponse(res, {
            preferences: user.preferences
        }, 'Preferences updated');
    } catch (error) {
        console.error('Update preferences error:', error);
        return errorResponse(res, 'Failed to update preferences', 500);
    }
};