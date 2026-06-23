// scripts/db-indexes.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  User,
  Vault,
  Device,
  Session,
  LoginHistory,
  SecurityAlert,
  BiometricData,
  AuditLog,
  RecoveryCode,
  RateLimit
} from '../model/index';

dotenv.config();

const mongoURL = process.env.MONGO_URI;

if (!mongoURL) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

export const createIndexes = async () => {
  try {
    await mongoose.connect(mongoURL);
    console.log('🌐 Connected to MongoDB');

    // Create all indexes
    await User.createIndexes();
    console.log('✅ User indexes created');

    await Vault.createIndexes();
    console.log('✅ Vault indexes created');

    await Device.createIndexes();
    console.log('✅ Device indexes created');

    await Session.createIndexes();
    console.log('✅ Session indexes created');

    await LoginHistory.createIndexes();
    console.log('✅ LoginHistory indexes created');

    await SecurityAlert.createIndexes();
    console.log('✅ SecurityAlert indexes created');

    await BiometricData.createIndexes();
    console.log('✅ BiometricData indexes created');

    await AuditLog.createIndexes();
    console.log('✅ AuditLog indexes created');

    await RecoveryCode.createIndexes();
    console.log('✅ RecoveryCode indexes created');

    await RateLimit.createIndexes();
    console.log('✅ RateLimit indexes created');

    console.log('🎉 All database indexes created successfully!');
    
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createIndexes();
}