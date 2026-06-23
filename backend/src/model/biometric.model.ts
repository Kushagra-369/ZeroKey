import mongoose, { Schema, Document } from 'mongoose';

export interface IBiometricData extends Document {
  userId: mongoose.Types.ObjectId;
  faceData: {
    embeddings: string; // Encrypted face embeddings
    landmarks: string;
    quality: number;
    capturedAt: Date;
  };
  handData: {
    landmarks: string;
    geometry: string;
    quality: number;
    capturedAt: Date;
  };
  gestureData: {
    pattern: string;
    sequence: string[];
    capturedAt: Date;
  };
  lastVerifiedAt: Date;
  attemptsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BiometricDataSchema = new Schema<IBiometricData>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  faceData: {
    embeddings: {
      type: String,
      select: false // Never expose raw biometric data
    },
    landmarks: {
      type: String,
      select: false
    },
    quality: {
      type: Number,
      min: 0,
      max: 100
    },
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  handData: {
    landmarks: {
      type: String,
      select: false
    },
    geometry: {
      type: String,
      select: false
    },
    quality: {
      type: Number,
      min: 0,
      max: 100
    },
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  gestureData: {
    pattern: {
      type: String,
      select: false
    },
    sequence: {
      type: [String],
      select: false
    },
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  lastVerifiedAt: {
    type: Date
  },
  attemptsCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const BiometricData = mongoose.model<IBiometricData>('BiometricData', BiometricDataSchema);