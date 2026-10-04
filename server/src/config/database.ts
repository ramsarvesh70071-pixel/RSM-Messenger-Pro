import mongoose from 'mongoose';
import { env } from './environment';

export const connectDatabase = async (retryCount = 0): Promise<typeof mongoose> => {
  const maxRetries = 5;
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);

  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected. Mongoose will attempt reconnect.');
    });

    return conn;
  } catch (error) {
    console.error(`[Database] Failed to connect to MongoDB (Attempt ${retryCount + 1}/${maxRetries}):`, error);
    if (retryCount < maxRetries && env.NODE_ENV !== 'test') {
      console.log(`[Database] Retrying connection in ${backoffMs}ms...`);
      await new Promise((res) => setTimeout(res, backoffMs));
      return connectDatabase(retryCount + 1);
    }
    throw error;
  }
};
