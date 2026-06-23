import { Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Device } from '../model/device.model';
import { Session } from '../model/session.model';
import { User } from '../model/user.model';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

// ==================== GET ALL DEVICES ====================
export const getDevices = async (req: AuthRequest, res: Response) => {
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

// ==================== GET DEVICE BY ID ====================
export const getDeviceById = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

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

        return successResponse(res, { device }, 'Device fetched successfully');
    } catch (error) {
        console.error('Get device error:', error);
        return errorResponse(res, 'Failed to fetch device', 500);
    }
};

// ==================== TRUST DEVICE ====================
export const trustDevice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

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

        device.isTrusted = true;
        device.isApproved = true;
        await device.save();

        return successResponse(res, { device }, 'Device trusted successfully');
    } catch (error) {
        console.error('Trust device error:', error);
        return errorResponse(res, 'Failed to trust device', 500);
    }
};

// ==================== UNTRUST DEVICE ====================
export const untrustDevice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

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

        device.isTrusted = false;
        await device.save();

        return successResponse(res, { device }, 'Device untrusted successfully');
    } catch (error) {
        console.error('Untrust device error:', error);
        return errorResponse(res, 'Failed to untrust device', 500);
    }
};

// ==================== APPROVE DEVICE ====================
export const approveDevice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;
        const { approvalToken } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!deviceId || typeof deviceId !== 'string') {
            return errorResponse(res, 'Device ID required', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(deviceId)) {
            return errorResponse(res, 'Invalid device ID', 400);
        }

        if (!approvalToken) {
            return errorResponse(res, 'Approval token required', 400);
        }

        const device = await Device.findOne({
            _id: new mongoose.Types.ObjectId(deviceId),
            userId
        });

        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        if (device.approvalToken !== approvalToken) {
            return errorResponse(res, 'Invalid approval token', 400);
        }

        if (device.approvalTokenExpires && new Date() > device.approvalTokenExpires) {
            return errorResponse(res, 'Approval token expired', 400);
        }

        // ✅ BEST FIX: Use $unset
        await Device.updateOne(
            { _id: new mongoose.Types.ObjectId(deviceId), userId },
            {
                $set: { isApproved: true, isTrusted: true },
                $unset: { approvalToken: "", approvalTokenExpires: "" }
            }
        );

        // Fetch updated device
        const updatedDevice = await Device.findOne({
            _id: new mongoose.Types.ObjectId(deviceId),
            userId
        });

        return successResponse(res, { device: updatedDevice }, 'Device approved successfully');
    } catch (error) {
        console.error('Approve device error:', error);
        return errorResponse(res, 'Failed to approve device', 500);
    }
};
// ==================== REJECT DEVICE ====================
export const rejectDevice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

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

        return successResponse(res, null, 'Device rejected and removed');
    } catch (error) {
        console.error('Reject device error:', error);
        return errorResponse(res, 'Failed to reject device', 500);
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

// ==================== GENERATE NEW APPROVAL TOKEN ====================
export const generateApprovalToken = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { deviceId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

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

        const newApprovalToken = crypto.randomBytes(32).toString('hex');
        device.approvalToken = newApprovalToken;
        device.approvalTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
        await device.save();

        return successResponse(res, {
            approvalToken: newApprovalToken,
            expiresIn: 10 * 60 // 10 minutes in seconds
        }, 'New approval token generated');
    } catch (error) {
        console.error('Generate approval token error:', error);
        return errorResponse(res, 'Failed to generate approval token', 500);
    }
};