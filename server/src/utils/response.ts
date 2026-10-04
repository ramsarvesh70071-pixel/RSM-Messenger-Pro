import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string | object;
  pagination?: {
    page?: number;
    limit: number;
    total?: number;
    hasMore: boolean;
    nextCursor?: any;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  pagination?: ApiResponse['pagination']
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    ...(pagination && { pagination })
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message = 'An error occurred',
  statusCode = 500,
  error?: string | object
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(error && { error })
  };
  return res.status(statusCode).json(response);
};
