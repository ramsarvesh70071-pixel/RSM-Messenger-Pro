import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/environment';
import { connectDatabase } from './config/database';
import { setupSocketHandlers } from './sockets/socket.handler';
import { startBackgroundJobs } from './jobs/cleanup.job';
import { SocketEmitter } from './services/socket-emitter.service';
import { isOriginAllowed } from './utils/cors';

const bootstrap = async (): Promise<void> => {
  try {
    // 1. Connect Database
    await connectDatabase();

    // 2. Initialize Express App
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO with strict CORS whitelist
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) return callback(null, true);
          return callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS`));
        },
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 20000,
      pingInterval: 10000,
      // Let a briefly-dropped mobile client resume without losing room membership/events
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false }
    });

    // 4. Initialize Socket Emitter Service & Attach Handlers
    SocketEmitter.init(io);
    setupSocketHandlers(io);

    // 5. Start Background Jobs
    startBackgroundJobs();

    // 6. Listen on PORT
    server.listen(env.PORT, () => {
      console.log(`\n========================================================`);
      console.log(`🚀 ${env.APP_NAME} Backend Server running!`);
      console.log(`🌐 REST API:    http://localhost:${env.PORT}/api/v1`);
      console.log(`⚡ WebSocket:   ws://localhost:${env.PORT}`);
      console.log(`📁 Static files: http://localhost:${env.PORT}/uploads`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/health`);
      console.log(`========================================================\n`);
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      io.close();
      server.close(async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed. Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Fatal bootstrap error:', error);
    process.exit(1);
  }
};

bootstrap();
