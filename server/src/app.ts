import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './config/environment';
import { apiRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import apiRoutes from './routes';
import { isOriginAllowed } from './utils/cors';

export const createApp = (): Application => {
  const app: Application = express();

  // Trust proxy for reverse proxy (Render, Cloudflare, etc.)
  app.set('trust proxy', 1);

  // Advanced Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  // Strict CORS Configuration from env.CORS_ORIGINS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Native apps/curl have no origin; LAN origins are allowed outside production
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  // Performance & Parsing
  app.use(compression());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Static uploads directory serving
  const uploadsDir = path.resolve(env.UPLOAD_DIR);
  app.use('/uploads', express.static(uploadsDir));

  // Global Rate Limiting
  app.use('/api', apiRateLimiter);

  // Health check endpoint (including real Mongo ping)
  app.get('/health', async (_req: Request, res: Response) => {
    const isMongoConnected = mongoose.connection.readyState === 1;
    let mongoPingMs = -1;

    if (isMongoConnected && mongoose.connection.db) {
      try {
        const start = Date.now();
        await mongoose.connection.db.admin().ping();
        mongoPingMs = Date.now() - start;
      } catch {
        mongoPingMs = -1;
      }
    }

    res.status(isMongoConnected ? 200 : 503).json({
      status: isMongoConnected ? 'UP' : 'DEGRADED',
      app: env.APP_NAME,
      database: isMongoConnected ? 'connected' : 'disconnected',
      mongoPingMs,
      timestamp: new Date().toISOString()
    });
  });

  // Mount API v1 Routes
  app.use('/api/v1', apiRoutes);

  // 404 Not Found Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
