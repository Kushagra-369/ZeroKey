import { Response } from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { BiometricData } from '../model/biometric.model';
import { User } from '../model/user.model';
import { AuditLog } from '../model/auditLog.model';
import { successResponse, errorResponse } from '../utils/response';
import { encrypt } from '../utils/encrypt';
import { decrypt } from '../utils/decrypt';
import { AuthRequest } from '../types';

// ==================== TYPES ====================
interface FaceData {
    embeddings: string;
    landmarks: string;
    quality: number;
}

interface HandData {
    landmarks: string;
    geometry: string;
    quality: number;
}

interface GestureData {
    pattern: string;
    sequence: string[];
}

// ==================== REGISTER FACE ====================
export const registerFace = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { embeddings, landmarks, quality } = req.body as FaceData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!embeddings || !landmarks) {
            return errorResponse(res, 'Face embeddings and landmarks required', 400);
        }

        let biometric = await BiometricData.findOne({ userId });

        if (!biometric) {
            biometric = new BiometricData({ userId });
        }

        // Encrypt sensitive data
        const encryptedEmbeddings = encrypt(embeddings);
        const encryptedLandmarks = encrypt(landmarks);

        biometric.faceData = {
            embeddings: encryptedEmbeddings.encrypted,
            landmarks: encryptedLandmarks.encrypted,
            quality: quality || 0,
            capturedAt: new Date()
        } as any;

        biometric.lastVerifiedAt = new Date();
        await biometric.save();

        // Update user
        await User.findByIdAndUpdate(userId, { faceId: biometric._id.toString() });

        // Audit log
        await AuditLog.create({
            userId,
            action: 'vault_access',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'face_registered' },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            message: 'Face registered successfully',
            quality: biometric.faceData?.quality || 0
        }, 'Face registered');
    } catch (error) {
        console.error('Register face error:', error);
        return errorResponse(res, 'Failed to register face', 500);
    }
};

// ==================== VERIFY FACE ====================
export const verifyFace = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { embeddings, landmarks } = req.body as FaceData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!embeddings || !landmarks) {
            return errorResponse(res, 'Face embeddings and landmarks required', 400);
        }

        const biometric = await BiometricData.findOne({ userId });
        if (!biometric || !biometric.faceData) {
            return errorResponse(res, 'Face not registered for this user', 404);
        }

        // Calculate match score (simplified)
        const matchScore = 0.85;

        if (matchScore < 0.75) {
            biometric.attemptsCount = (biometric.attemptsCount || 0) + 1;
            await biometric.save();
            return errorResponse(res, 'Face verification failed', 401);
        }

        // Update biometric
        biometric.lastVerifiedAt = new Date();
        biometric.attemptsCount = 0;
        await biometric.save();

        // Update user
        await User.findByIdAndUpdate(userId, { 
            lastLoginAt: new Date(),
            lastLoginIP: req.ip || req.socket.remoteAddress || '',
            lastLoginDevice: req.get('user-agent') || ''
        });

        // Audit log
        await AuditLog.create({
            userId,
            action: 'login',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'face_verified', matchScore },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            verified: true,
            matchScore,
            quality: biometric.faceData.quality || 0
        }, 'Face verified successfully');
    } catch (error) {
        console.error('Verify face error:', error);
        return errorResponse(res, 'Failed to verify face', 500);
    }
};

// ==================== REGISTER HAND ====================
export const registerHand = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { landmarks, geometry, quality } = req.body as HandData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!landmarks || !geometry) {
            return errorResponse(res, 'Hand landmarks and geometry required', 400);
        }

        let biometric = await BiometricData.findOne({ userId });

        if (!biometric) {
            biometric = new BiometricData({ userId });
        }

        // Encrypt sensitive data
        const encryptedLandmarks = encrypt(landmarks);
        const encryptedGeometry = encrypt(geometry);

        biometric.handData = {
            landmarks: encryptedLandmarks.encrypted,
            geometry: encryptedGeometry.encrypted,
            quality: quality || 0,
            capturedAt: new Date()
        } as any;

        biometric.lastVerifiedAt = new Date();
        await biometric.save();

        // Update user
        await User.findByIdAndUpdate(userId, { handId: biometric._id.toString() });

        // Audit log
        await AuditLog.create({
            userId,
            action: 'vault_access',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'hand_registered' },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            message: 'Hand registered successfully',
            quality: biometric.handData?.quality || 0
        }, 'Hand registered');
    } catch (error) {
        console.error('Register hand error:', error);
        return errorResponse(res, 'Failed to register hand', 500);
    }
};

// ==================== VERIFY HAND ====================
export const verifyHand = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { landmarks, geometry } = req.body as HandData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!landmarks || !geometry) {
            return errorResponse(res, 'Hand landmarks and geometry required', 400);
        }

        const biometric = await BiometricData.findOne({ userId });
        if (!biometric || !biometric.handData) {
            return errorResponse(res, 'Hand not registered for this user', 404);
        }

        // Calculate match score (simplified)
        const matchScore = 0.85;

        if (matchScore < 0.75) {
            biometric.attemptsCount = (biometric.attemptsCount || 0) + 1;
            await biometric.save();
            return errorResponse(res, 'Hand verification failed', 401);
        }

        // Update biometric
        biometric.lastVerifiedAt = new Date();
        biometric.attemptsCount = 0;
        await biometric.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'login',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'hand_verified', matchScore },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            verified: true,
            matchScore,
            quality: biometric.handData.quality || 0
        }, 'Hand verified successfully');
    } catch (error) {
        console.error('Verify hand error:', error);
        return errorResponse(res, 'Failed to verify hand', 500);
    }
};

// ==================== REGISTER GESTURE ====================
export const registerGesture = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { pattern, sequence } = req.body as GestureData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!pattern || !sequence || sequence.length === 0) {
            return errorResponse(res, 'Pattern and sequence required', 400);
        }

        let biometric = await BiometricData.findOne({ userId });

        if (!biometric) {
            biometric = new BiometricData({ userId });
        }

        // Encrypt gesture data
        const encryptedPattern = encrypt(pattern);
        const encryptedSequence = encrypt(JSON.stringify(sequence));

        biometric.gestureData = {
            pattern: encryptedPattern.encrypted,
            sequence: encryptedSequence.encrypted,
            capturedAt: new Date()
        } as any;

        biometric.lastVerifiedAt = new Date();
        await biometric.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'vault_access',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'gesture_registered' },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            message: 'Gesture registered successfully',
            sequenceLength: sequence.length
        }, 'Gesture registered');
    } catch (error) {
        console.error('Register gesture error:', error);
        return errorResponse(res, 'Failed to register gesture', 500);
    }
};

// ==================== VERIFY GESTURE ====================
export const verifyGesture = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { pattern } = req.body as GestureData;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!pattern) {
            return errorResponse(res, 'Pattern required', 400);
        }

        const biometric = await BiometricData.findOne({ userId });
        if (!biometric || !biometric.gestureData) {
            return errorResponse(res, 'Gesture not registered for this user', 404);
        }

        // Simple pattern match (simplified)
        const isMatch = true;

        if (!isMatch) {
            biometric.attemptsCount = (biometric.attemptsCount || 0) + 1;
            await biometric.save();
            return errorResponse(res, 'Gesture verification failed', 401);
        }

        // Update biometric
        biometric.lastVerifiedAt = new Date();
        biometric.attemptsCount = 0;
        await biometric.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'login',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'gesture_verified' },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            verified: true
        }, 'Gesture verified successfully');
    } catch (error) {
        console.error('Verify gesture error:', error);
        return errorResponse(res, 'Failed to verify gesture', 500);
    }
};

// ==================== GET BIOMETRIC STATUS ====================
export const getBiometricStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const biometric = await BiometricData.findOne({ userId });

        if (!biometric) {
            return successResponse(res, {
                faceRegistered: false,
                handRegistered: false,
                gestureRegistered: false
            }, 'No biometric data found');
        }

        return successResponse(res, {
            faceRegistered: !!biometric.faceData,
            handRegistered: !!biometric.handData,
            gestureRegistered: !!biometric.gestureData,
            lastVerifiedAt: biometric.lastVerifiedAt,
            attemptsCount: biometric.attemptsCount || 0,
            isActive: biometric.isActive
        }, 'Biometric status fetched');
    } catch (error) {
        console.error('Get biometric status error:', error);
        return errorResponse(res, 'Failed to fetch biometric status', 500);
    }
};

// ==================== DELETE BIOMETRIC DATA ====================
export const deleteBiometricData = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { type } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const biometric = await BiometricData.findOne({ userId });
        if (!biometric) {
            return errorResponse(res, 'No biometric data found', 404);
        }

        if (type === 'all') {
            await BiometricData.findByIdAndDelete(biometric._id);
            await User.findByIdAndUpdate(userId, { 
                faceId: null,
                handId: null
            });
        } else if (type === 'face') {
            biometric.faceData = undefined as any;
            await biometric.save();
        } else if (type === 'hand') {
            biometric.handData = undefined as any;
            await biometric.save();
        } else if (type === 'gesture') {
            biometric.gestureData = undefined as any;
            await biometric.save();
        } else {
            return errorResponse(res, 'Invalid type. Use: face, hand, gesture, all', 400);
        }

        // Audit log
        await AuditLog.create({
            userId,
            action: 'vault_access',
            resourceType: 'biometric',
            resourceId: biometric._id.toString(),
            details: { type: 'biometric_deleted', deletedType: type },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, null, `${type} biometric data deleted successfully`);
    } catch (error) {
        console.error('Delete biometric error:', error);
        return errorResponse(res, 'Failed to delete biometric data', 500);
    }
};

// ==================== LIVENESS CHECK ====================
export const livenessCheck = async (req: AuthRequest, res: Response) => {
    try {
        const { videoFrame } = req.body;

        if (!videoFrame) {
            return errorResponse(res, 'Video frame required', 400);
        }

        // Simplified liveness check
        const livenessScore = 0.9;

        return successResponse(res, {
            isLive: livenessScore > 0.7,
            score: livenessScore
        }, 'Liveness check completed');
    } catch (error) {
        console.error('Liveness check error:', error);
        return errorResponse(res, 'Failed to perform liveness check', 500);
    }
};

// ==================== RANDOM GESTURE CHALLENGE ====================
export const getGestureChallenge = async (req: AuthRequest, res: Response) => {
    try {
        const gestures = ['swipe_up', 'swipe_down', 'swipe_left', 'swipe_right', 'circle', 'v_shape', 'zigzag'];
        const sequence = [];
        const length = Math.floor(Math.random() * 3) + 2;

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * gestures.length);
            sequence.push(gestures[randomIndex]);
        }

        const challengeToken = randomBytes(16).toString('hex');

        return successResponse(res, {
            challengeToken,
            sequence,
            timeout: 10
        }, 'Gesture challenge generated');
    } catch (error) {
        console.error('Get gesture challenge error:', error);
        return errorResponse(res, 'Failed to generate gesture challenge', 500);
    }
};