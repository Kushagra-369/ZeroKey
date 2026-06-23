import { Response } from 'express';

export const successResponse = (res: Response, data: any, message: string = 'Success', status: number = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

export const errorResponse = (res: Response, error: string, status: number = 400) => {
  return res.status(status).json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  });
};