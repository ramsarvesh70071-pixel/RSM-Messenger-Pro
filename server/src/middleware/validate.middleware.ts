import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';
import mongoose from 'mongoose';
import { sendError } from '../utils/response';

export interface ValidationTarget {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export type SchemaInput = ValidationTarget | z.ZodTypeAny;

// Reusable ObjectId validator
export const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Must be a valid 24-character hexadecimal ObjectId'
});

export const validate = (schema: SchemaInput) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isZodType = 'parseAsync' in schema;
      const target: ValidationTarget = isZodType ? { body: schema as any } : (schema as ValidationTarget);

      if (target.params) {
        req.params = (await target.params.parseAsync(req.params)) as any;
      }
      if (target.query) {
        req.query = (await target.query.parseAsync(req.query)) as any;
      }
      if (target.body) {
        req.body = (await target.body.parseAsync(req.body)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.issues
          .map((i) => `[${i.path.join('.') || 'payload'}]: ${i.message}`)
          .join('; ');
        sendError(res, `Validation failed: ${formatted}`, 400);
        return;
      }
      sendError(res, 'Invalid request structure', 400);
    }
  };
};
