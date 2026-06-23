import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: 'login' | 'logout' | 'vault_access' | 'password_created' | 'password_updated' | 'password_deleted' | 'vault_exported' | 'vault_imported' | 'device_added' | 'device_removed' | 'device_trusted' | 'settings_changed' | 'recovery_used' | 'emergency_access_granted';
  resourceType: 'user' | 'vault' | 'device' | 'session' | 'biometric' | 'setting';
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  location?: {
    city?: string;
    country?: string;
  };
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  metadata: {
    duration?: number;
    requestId?: string;
  };
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['login', 'logout', 'vault_access', 'password_created', 'password_updated', 'password_deleted', 'vault_exported', 'vault_imported', 'device_added', 'device_removed', 'device_trusted', 'settings_changed', 'recovery_used', 'emergency_access_granted'],
    required: true
  },
  resourceType: {
    type: String,
    enum: ['user', 'vault', 'device', 'session', 'biometric', 'setting'],
    required: true
  },
  resourceId: {
    type: String
  },
  details: {
    type: Schema.Types.Mixed,
    default: {}
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
    country: String
  },
  success: {
    type: Boolean,
    required: true
  },
  errorMessage: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    duration: Number,
    requestId: String
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

// TTL index for automatic cleanup (keep logs for 90 days)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes
AuditLogSchema.index({ userId: 1, action: 1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);