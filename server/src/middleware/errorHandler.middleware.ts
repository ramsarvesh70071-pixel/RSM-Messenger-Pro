import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Unhandled Server Error]:', err);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    sendError(res, `A record with this ${field} already exists.`, 409);
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    sendError(res, messages.join(', ') || 'Validation error', 400);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(res, 'Invalid or expired session token', 401);
    return;
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    sendError(res, `File upload error: ${err.message}`, 400);
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  sendError(res, message, statusCode);
};
