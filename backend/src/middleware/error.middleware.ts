import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: any;
  keyValue?: any;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  console.error('❌ Error:', error);

  // ==================== MONGOOSE ERRORS ====================
  
  // CastError (Invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    const message = `Resource not found with id of ${err.value}`;
    return res.status(404).json({
      success: false,
      error: message
    });
  }

  // ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((val: any) => val.message);
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  // Duplicate key error (MongoDB)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const message = `${field} already exists`;
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  // ==================== JWT ERRORS ====================
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  // ==================== CUSTOM ERRORS ====================
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};