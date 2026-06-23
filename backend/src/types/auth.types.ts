import { Request } from 'express';
import { IUser } from '../model/user.model';

// Request types
export interface LoginRequest {
  email: string;
  password?: string;
  faceId?: string;
  handId?: string;
  deviceId?: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password?: string;
  faceData?: any;
  handData?: any;
}

export interface VerifyRequest {
  email: string;
  code: string;
}

// Response types
export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: Partial<IUser>;
  error?: string;
}

// Extended Request with user
export interface AuthRequest extends Request {
  user?: IUser;
  token?: string;
}

// JWT Payload
export interface JwtPayload {
  id: string;
  email: string;
  deviceId?: string;
  iat?: number;
  exp?: number;
}