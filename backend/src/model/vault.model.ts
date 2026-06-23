import mongoose, { Schema, Document } from 'mongoose';

export interface IVault extends Document {
    userId: mongoose.Types.ObjectId;
    entries: IVaultEntry[];
    totalEntries: number;
    securityScore: number;
    lastAccessed: Date;
    isEncrypted: boolean;
    encryptionKey: string; // AES-256 key (stored encrypted)
    createdAt: Date;
    updatedAt: Date;
}

export interface IVaultEntry {
    _id?: mongoose.Types.ObjectId;
    title: string;
    username?: string;
    password: string;
    url?: string;
    notes?: string;
    category: 'social' | 'banking' | 'email' | 'work' | 'personal' | 'entertainment' | 'other';
    icon?: string;
    favicon?: string;
    tags: string[];
    isFavorite: boolean;
    isArchived: boolean;
    strength: number; // Password strength score 0-100
    lastModified: Date;
    lastUsed?: Date;
    expiresAt?: Date;
    customFields: {
        key: string;
        value: string;
    }[];
    attachments: {
        name: string;
        url: string;
        size: number;
        mimeType: string;
        uploadedAt: Date;
    }[];
    notesHistory: {
        content: string;
        modifiedAt: Date;
    }[];
}

const VaultEntrySchema = new Schema<IVaultEntry>({
    title: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    url: {
        type: String,
        trim: true
    },
    notes: {
        type: String
    },
    category: {
        type: String,
        enum: ['social', 'banking', 'email', 'work', 'personal', 'entertainment', 'other'],
        default: 'other'
    },
    icon: {
        type: String
    },
    favicon: {
        type: String
    },
    tags: {
        type: [String],
        default: []
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    strength: {
        type: Number,
        min: 0,
        max: 100
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    lastUsed: {
        type: Date
    },
    expiresAt: {
        type: Date
    },
    customFields: [{
        key: String,
        value: String
    }],
    attachments: [{
        name: String,
        url: String,
        size: Number,
        mimeType: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    notesHistory: [{
        content: String,
        modifiedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const VaultSchema = new Schema<IVault>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    entries: [VaultEntrySchema],
    totalEntries: {
        type: Number,
        default: 0
    },
    securityScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    isEncrypted: {
        type: Boolean,
        default: true
    },
    encryptionKey: {
        type: String,
        select: false // Never expose encryption key
    }
}, {
    timestamps: true
});

// Index for faster queries
VaultSchema.index({ userId: 1 });
VaultSchema.index({ 'entries.category': 1 });
VaultSchema.index({ 'entries.isFavorite': 1 });
VaultSchema.index({ 'entries.tags': 1 });

export const Vault = mongoose.model<IVault>('Vault', VaultSchema);