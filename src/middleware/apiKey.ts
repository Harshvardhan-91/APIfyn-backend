import { Request, Response, NextFunction } from 'express';
import { CustomError } from './errorHandler';

// Simple API key validation middleware (placeholder for future implementation)
export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new CustomError('API key is required', 401);
    }

    // For now, just check if it's a non-empty string
    // You can implement proper API key validation later
    if (apiKey.length < 10) {
      throw new CustomError('Invalid API key', 401);
    }

    // Add placeholder user info to request
    (req as any).apiUser = {
      id: 'api-user',
      email: 'api@example.com'
    };
    
    next();
  } catch (error) {
    next(error);
  }
};
