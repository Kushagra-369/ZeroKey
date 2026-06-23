import mongoose, { Schema, Document } from 'mongoose';

export interface IRateLimit extends Document {
  key: string; // IP or user ID
  endpoint: string;
  method: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: {
    type: String,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 1
  },
  windowStart: {
    type: Date,
    required: true
  },
  windowEnd: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

// Compound index for faster lookups
RateLimitSchema.index({ key: 1, endpoint: 1, method: 1 });
// Auto-delete old rate limit records
RateLimitSchema.index({ windowEnd: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);