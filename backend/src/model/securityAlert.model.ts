import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityAlert extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'suspicious_login' | 'new_device' | 'failed_attempts' | 'password_breach' | 'account_lock' | 'recovery_request' | 'emergency_access' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: Record<string, any>;
  isRead: boolean;
  isDismissed: boolean;
  actionTaken?: string;
  metadata: {
    ipAddress?: string;
    location?: string;
    deviceId?: string;
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SecurityAlertSchema = new Schema<ISecurityAlert>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['suspicious_login', 'new_device', 'failed_attempts', 'password_breach', 'account_lock', 'recovery_request', 'emergency_access', 'unusual_activity'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isDismissed: {
    type: Boolean,
    default: false
  },
  actionTaken: {
    type: String
  },
  metadata: {
    ipAddress: String,
    location: String,
    deviceId: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes
SecurityAlertSchema.index({ userId: 1, createdAt: -1 });
SecurityAlertSchema.index({ userId: 1, isRead: 1 });
SecurityAlertSchema.index({ userId: 1, severity: 1 });

export const SecurityAlert = mongoose.model<ISecurityAlert>('SecurityAlert', SecurityAlertSchema);