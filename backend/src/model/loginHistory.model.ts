import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginHistory extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  success: boolean;
  method:
  | 'password'
  | 'otp'
  | 'face'
  | 'hand'
  | 'gesture'
  | 'recovery'
  | 'magic_link';
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  location?: {
    city?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  failureReason?: string;
  riskScore?: number;
  isSuspicious: boolean;
  suspiciousFlags: string[];
  createdAt: Date;
}

const LoginHistorySchema = new Schema<ILoginHistory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  success: {
    type: Boolean,
    required: true
  },
  method: {
    type: String,
    enum: [
      'password',
      'otp',
      'face',
      'hand',
      'gesture',
      'recovery',
      'magic_link'
    ],
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceId: {
    type: String
  },
  location: {
    city: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  failureReason: {
    type: String
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100
  },
  isSuspicious: {
    type: Boolean,
    default: false
  },
  suspiciousFlags: {
    type: [String],
    default: []
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

// Indexes for analytics
LoginHistorySchema.index({ userId: 1, createdAt: -1 });
LoginHistorySchema.index({ userId: 1, success: 1 });
LoginHistorySchema.index({ ipAddress: 1, createdAt: -1 });

export const LoginHistory = mongoose.model<ILoginHistory>('LoginHistory', LoginHistorySchema);