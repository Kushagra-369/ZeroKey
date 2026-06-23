import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'browser' | 'other';
  os: string;
  browser: string;
  browserVersion?: string;
  ipAddress: string;
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  fingerprint: string;
  userAgent: string;
  isTrusted: boolean;
  isCurrent: boolean;
  isActive: boolean;
  isApproved: boolean;
  approvalToken?: string;
  approvalTokenExpires?: Date;
  lastLoginAt: Date;
  lastLoginIP: string;
  loginCount: number;
  riskScore: number; // 0-100
  riskFactors: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    screenResolution?: string;
    language?: string;
    platform?: string;
    timezone?: string;
    touchSupport?: boolean;
  };
}

const DeviceSchema = new Schema<IDevice>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  deviceName: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'browser', 'other'],
    default: 'other'
  },
  os: {
    type: String,
    required: true
  },
  browser: {
    type: String,
    required: true
  },
  browserVersion: {
    type: String
  },
  ipAddress: {
    type: String,
    required: true
  },
  location: {
    city: String,
    country: String,
    timezone: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  fingerprint: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  isTrusted: {
    type: Boolean,
    default: false
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvalToken: {
    type: String,
    required: false,
    default: null
  },
  approvalTokenExpires: {
    type: Date,
    required: false,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  lastLoginIP: {
    type: String,
    required: true
  },
  loginCount: {
    type: Number,
    default: 0
  },
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  riskFactors: {
    type: [String],
    default: []
  },
  metadata: {
    screenResolution: String,
    language: String,
    platform: String,
    timezone: String,
    touchSupport: Boolean
  }
}, {
  timestamps: true
});

// Compound index for quick lookups
DeviceSchema.index({ userId: 1, deviceId: 1 });
DeviceSchema.index({ userId: 1, isTrusted: 1 });
DeviceSchema.index({ userId: 1, isApproved: 1 });

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);