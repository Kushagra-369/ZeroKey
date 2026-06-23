import { Request, Response, NextFunction } from 'express';
import { RateLimit } from '../model/rateLimit.model';


const memoryStore = new Map<string, { count: number; resetAt: Date }>();

export const rateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${req.ip}-${req.path}`;
      const now = new Date();
      const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
      const max = options.max || 100;
      
      // Check in-memory store
      let record = memoryStore.get(key);
      
      if (!record || now > record.resetAt) {
        // New window
        record = {
          count: 1,
          resetAt: new Date(now.getTime() + windowMs)
        };
        memoryStore.set(key, record);
        return next();
      }
      
      // Increment count
      record.count += 1;
      memoryStore.set(key, record);
      
      // Check if over limit
      if (record.count > max) {
        const retryAfter = Math.ceil((record.resetAt.getTime() - now.getTime()) / 1000);
        
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt.getTime() / 1000));
        
        return res.status(429).json({
          success: false,
          error: options.message || 'Too many requests, please try again later.'
        });
      }
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - record.count);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt.getTime() / 1000));
      
      next();
      
    } catch (error) {
      // If rate limiter fails, allow request (fail open)
      console.error('Rate limiter error:', error);
      next();
    }
  };
};

// Clean up old records periodically
setInterval(() => {
  const now = new Date();
  for (const [key, value] of memoryStore.entries()) {
    if (now > value.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute