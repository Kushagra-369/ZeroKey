import { Response } from 'express';
import mongoose from 'mongoose';
import { Vault } from '../model/vault.model';
import { AuditLog } from '../model/auditLog.model';
import { successResponse, errorResponse } from '../utils/response';
import { encrypt } from '../utils/encrypt';
import { decrypt } from '../utils/decrypt';
import { AuthRequest } from '../types';
import * as crypto from 'crypto';  // ✅ Top par add karo

// ==================== GET VAULT ====================
export const getVault = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        let vault = await Vault.findOne({ userId });

        if (!vault) {
            // Create new vault if doesn't exist
            vault = await Vault.create({
                userId,
                entries: [],
                totalEntries: 0,
                securityScore: 0,
                isEncrypted: true
            });
        }

        // Decrypt entries before sending
        const decryptedEntries = vault.entries.map((entry: any) => {
            try {
                const decryptedPassword = decrypt(
                    entry.password,
                    entry.iv || '',
                    entry.authTag || ''
                );
                return {
                    ...entry.toObject(),
                    password: decryptedPassword
                };
            } catch (error) {
                return {
                    ...entry.toObject(),
                    password: '***DECRYPTION_FAILED***'
                };
            }
        });

        // Update last accessed
        vault.lastAccessed = new Date();
        await vault.save();

        return successResponse(res, {
            vault: {
                ...vault.toObject(),
                entries: decryptedEntries
            }
        }, 'Vault fetched successfully');
    } catch (error) {
        console.error('Get vault error:', error);
        return errorResponse(res, 'Failed to fetch vault', 500);
    }
};

// ==================== ADD ENTRY ====================
export const addEntry = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const {
            title,
            username,
            password,
            url,
            notes,
            category,
            tags,
            isFavorite
        } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!title || !password) {
            return errorResponse(res, 'Title and password are required', 400);
        }

        let vault = await Vault.findOne({ userId });
        if (!vault) {
            vault = await Vault.create({
                userId,
                entries: [],
                totalEntries: 0,
                securityScore: 0,
                isEncrypted: true
            });
        }

        // Encrypt password
        const encrypted = encrypt(password);

        const newEntry = {
            title,
            username: username || '',
            password: encrypted.encrypted,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            url: url || '',
            notes: notes || '',
            category: category || 'other',
            tags: tags || [],
            isFavorite: isFavorite || false,
            isArchived: false,
            strength: calculatePasswordStrength(password),
            lastModified: new Date(),
            customFields: [],
            attachments: [],
            notesHistory: []
        };

        vault.entries.push(newEntry as any);
        vault.totalEntries = vault.entries.length;
        vault.lastAccessed = new Date();
        await vault.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'password_created',
            resourceType: 'vault',
            resourceId: vault._id.toString(),  // string mein convert
            details: { title },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            entry: newEntry
        }, 'Entry added successfully');
    } catch (error) {
        console.error('Add entry error:', error);
        return errorResponse(res, 'Failed to add entry', 500);
    }
};

// ==================== GET ENTRY BY ID ====================
export const getEntryById = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { entryId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!entryId || typeof entryId !== 'string') {
            return errorResponse(res, 'Entry ID required', 400);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return errorResponse(res, 'Vault not found', 404);
        }

        const entry = (vault.entries as any).id(entryId);
        if (!entry) {
            return errorResponse(res, 'Entry not found', 404);
        }

        // Decrypt password
        try {
            const decryptedPassword = decrypt(
                entry.password,
                entry.iv || '',
                entry.authTag || ''
            );
            return successResponse(res, {
                entry: {
                    ...entry.toObject(),
                    password: decryptedPassword
                }
            }, 'Entry fetched successfully');
        } catch (error) {
            return successResponse(res, {
                entry: {
                    ...entry.toObject(),
                    password: '***DECRYPTION_FAILED***'
                }
            }, 'Entry fetched (decryption failed)');
        }
    } catch (error) {
        console.error('Get entry error:', error);
        return errorResponse(res, 'Failed to fetch entry', 500);
    }
};

// ==================== UPDATE ENTRY ====================
export const updateEntry = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { entryId } = req.params;
        const {
            title,
            username,
            password,
            url,
            notes,
            category,
            tags,
            isFavorite,
            isArchived
        } = req.body;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!entryId || typeof entryId !== 'string') {
            return errorResponse(res, 'Entry ID required', 400);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return errorResponse(res, 'Vault not found', 404);
        }

        const entry = (vault.entries as any).id(entryId);

        if (!entry) {
            return errorResponse(res, 'Entry not found', 404);
        }

        // Update fields
        if (title) entry.title = title;
        if (username !== undefined) entry.username = username;
        if (url !== undefined) entry.url = url;
        if (notes !== undefined) entry.notes = notes;
        if (category) entry.category = category;
        if (tags) entry.tags = tags;
        if (isFavorite !== undefined) entry.isFavorite = isFavorite;
        if (isArchived !== undefined) entry.isArchived = isArchived;

        // If password changed, encrypt new one
        if (password) {
            const encrypted = encrypt(password);
            entry.password = encrypted.encrypted;
            entry.iv = encrypted.iv;
            entry.authTag = encrypted.authTag;
            entry.strength = calculatePasswordStrength(password);
        }

        entry.lastModified = new Date();
        vault.lastAccessed = new Date();
        await vault.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'password_updated',
            resourceType: 'vault',
            resourceId: vault._id.toString(),  // string mein convert
            details: { title: entry.title },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, {
            entry
        }, 'Entry updated successfully');
    } catch (error) {
        console.error('Update entry error:', error);
        return errorResponse(res, 'Failed to update entry', 500);
    }
};

// ==================== DELETE ENTRY ====================
export const deleteEntry = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { entryId } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!entryId || typeof entryId !== 'string') {
            return errorResponse(res, 'Entry ID required', 400);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return errorResponse(res, 'Vault not found', 404);
        }

        const entry = (vault.entries as any).id(entryId);

        if (!entry) {
            return errorResponse(res, 'Entry not found', 404);
        }

        const entryTitle = entry.title;
        vault.entries = vault.entries.filter(
            (entry: any) => entry._id.toString() !== entryId
        ); vault.totalEntries = vault.entries.length;
        vault.lastAccessed = new Date();
        await vault.save();

        // Audit log
        await AuditLog.create({
            userId,
            action: 'password_deleted',
            resourceType: 'vault',
            resourceId: vault._id.toString(),
            details: { title: entryTitle },
            ipAddress: req.ip || req.socket.remoteAddress || '',
            userAgent: req.get('user-agent') || '',
            success: true
        });

        return successResponse(res, null, 'Entry deleted successfully');
    } catch (error) {
        console.error('Delete entry error:', error);
        return errorResponse(res, 'Failed to delete entry', 500);
    }
};

// ==================== SEARCH ENTRIES ====================
export const searchEntries = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { q } = req.query;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        if (!q || typeof q !== 'string') {
            return errorResponse(res, 'Search query required', 400);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return successResponse(res, { entries: [] }, 'No entries found');
        }

        const searchLower = q.toLowerCase();
        const filteredEntries = vault.entries.filter((entry: any) => {
            return (
                entry.title.toLowerCase().includes(searchLower) ||
                (entry.username && entry.username.toLowerCase().includes(searchLower)) ||
                (entry.url && entry.url.toLowerCase().includes(searchLower)) ||
                (entry.notes && entry.notes.toLowerCase().includes(searchLower)) ||
                (entry.tags && entry.tags.some((tag: string) =>
                    tag.toLowerCase().includes(searchLower)
                ))
            );
        });

        // Decrypt entries
        const decryptedEntries = filteredEntries.map((entry: any) => {
            try {
                const decryptedPassword = decrypt(
                    entry.password,
                    entry.iv || '',
                    entry.authTag || ''
                );
                return {
                    ...entry.toObject(),
                    password: decryptedPassword
                };
            } catch (error) {
                return {
                    ...entry.toObject(),
                    password: '***DECRYPTION_FAILED***'
                };
            }
        });

        return successResponse(res, {
            entries: decryptedEntries,
            total: decryptedEntries.length
        }, 'Search results fetched');
    } catch (error) {
        console.error('Search entries error:', error);
        return errorResponse(res, 'Failed to search entries', 500);
    }
};

// ==================== GET BY CATEGORY ====================
export const getByCategory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { category } = req.params;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return successResponse(res, { entries: [] }, 'No entries found');
        }

        const filteredEntries = vault.entries.filter(
            (entry: any) => entry.category === category && !entry.isArchived
        );

        const decryptedEntries = filteredEntries.map((entry: any) => {
            try {
                const decryptedPassword = decrypt(
                    entry.password,
                    entry.iv || '',
                    entry.authTag || ''
                );
                return {
                    ...entry.toObject(),
                    password: decryptedPassword
                };
            } catch (error) {
                return {
                    ...entry.toObject(),
                    password: '***DECRYPTION_FAILED***'
                };
            }
        });

        return successResponse(res, {
            entries: decryptedEntries,
            total: decryptedEntries.length
        }, 'Entries by category fetched');
    } catch (error) {
        console.error('Get by category error:', error);
        return errorResponse(res, 'Failed to fetch entries by category', 500);
    }
};

// ==================== GET FAVORITES ====================
export const getFavorites = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const vault = await Vault.findOne({ userId });
        if (!vault) {
            return successResponse(res, { entries: [] }, 'No entries found');
        }

        const filteredEntries = vault.entries.filter(
            (entry: any) => entry.isFavorite && !entry.isArchived
        );

        const decryptedEntries = filteredEntries.map((entry: any) => {
            try {
                const decryptedPassword = decrypt(
                    entry.password,
                    entry.iv || '',
                    entry.authTag || ''
                );
                return {
                    ...entry.toObject(),
                    password: decryptedPassword
                };
            } catch (error) {
                return {
                    ...entry.toObject(),
                    password: '***DECRYPTION_FAILED***'
                };
            }
        });

        return successResponse(res, {
            entries: decryptedEntries,
            total: decryptedEntries.length
        }, 'Favorite entries fetched');
    } catch (error) {
        console.error('Get favorites error:', error);
        return errorResponse(res, 'Failed to fetch favorites', 500);
    }
};

// ==================== GENERATE STRONG PASSWORD ====================
export const generatePassword = async (req: AuthRequest, res: Response) => {
    try {
        const {
            length = 16,
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true
        } = req.body;

        let charset = '';
        if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (includeNumbers) charset += '0123456789';
        if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (!charset) {
            return errorResponse(res, 'At least one character type must be selected', 400);
        }

        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = parseInt(crypto.randomBytes(4).toString('hex'), 16) % charset.length;
            password += charset[randomIndex];
        }

        const strength = calculatePasswordStrength(password);

        return successResponse(res, {
            password,
            strength,
            length: password.length
        }, 'Password generated successfully');
    } catch (error) {
        console.error('Generate password error:', error);
        return errorResponse(res, 'Failed to generate password', 500);
    }
};

// ==================== HELPER: CALCULATE PASSWORD STRENGTH ====================
const calculatePasswordStrength = (password: string): number => {
    let score = 0;

    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 20;

    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 10;

    return Math.min(score, 100);
};