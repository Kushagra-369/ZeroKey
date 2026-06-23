import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    email: string;
    password?: string; // Optional because of passwordless login
    isPasswordless: boolean;
    faceId?: string; // Store face embedding/identifier
    handId?: string; // Store hand geometry data
    name: string;
    avatar?: string;
    securityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    isVerified: boolean;
    isActive: boolean;
    isLocked: boolean;
    lockedUntil?: Date;
    failedLoginAttempts: number;
    lastLoginAt?: Date;
    lastLoginIP?: string;
    lastLoginDevice?: string;
    recoveryCodes: string[];
    emergencyAccess: {
        enabled: boolean;
        emails: string[];
        waitTime: number; // in hours
        approvedAt?: Date;
    };
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    preferences: {
        theme: 'light' | 'dark' | 'system';
        autoLogoutMinutes: number;
        language: string;
    };
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    incrementLoginAttempts(): Promise<void>;
    resetLoginAttempts(): Promise<void>;
}

const UserSchema = new Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        select: false
    },
    isPasswordless: {
        type: Boolean,
        default: true
    },
    faceId: {
        type: String,
        sparse: true
    },
    handId: {
        type: String,
        sparse: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    avatar: {
        type: String
    },
    securityScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    lockedUntil: {
        type: Date
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lastLoginAt: {
        type: Date
    },
    lastLoginIP: {
        type: String
    },
    lastLoginDevice: {
        type: String
    },
    recoveryCodes: {
        type: [String],
        default: []
    },
    emergencyAccess: {
        enabled: {
            type: Boolean,
            default: false
        },
        emails: [String],
        waitTime: {
            type: Number,
            default: 24 // hours
        },
        approvedAt: Date
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
    },
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        },
        autoLogoutMinutes: {
            type: Number,
            default: 30
        },
        language: {
            type: String,
            default: 'en'
        }
    }
}, {
    timestamps: true
});

UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    if (this.password) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function () {
    this.failedLoginAttempts += 1;

    if (this.failedLoginAttempts >= 10) {
        this.isLocked = true;
        this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }

    await this.save();
};

// Reset login attempts
UserSchema.methods.resetLoginAttempts = async function () {
    this.failedLoginAttempts = 0;
    this.isLocked = false;
    this.lockedUntil = undefined;
    await this.save();
};

export const User = mongoose.model<IUser>('User', UserSchema);