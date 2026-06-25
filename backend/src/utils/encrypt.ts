import crypto from 'crypto';
import dotenv from "dotenv";

dotenv.config();

const algorithm = 'aes-256-gcm';
console.log("KEY:", process.env.ENCRYPTION_KEY);
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'utf8');

export const encrypt = (text: string) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};