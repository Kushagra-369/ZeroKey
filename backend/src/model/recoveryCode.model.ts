import mongoose, { Schema, Document } from 'mongoose';

export interface IRecoveryCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  type: 'backup' | 'emergency' | 'device';
  used: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const RecoveryCodeSchema = new Schema<IRecoveryCode>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    select: false // Never expose recovery codes
  },
  type: {
    type: String,
    enum: ['backup', 'emergency', 'device'],
    default: 'backup'
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true,
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

// Auto-delete expired codes
RecoveryCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RecoveryCode = mongoose.model<IRecoveryCode>('RecoveryCode', RecoveryCodeSchema);