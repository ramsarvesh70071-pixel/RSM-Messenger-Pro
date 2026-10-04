import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Strict environment schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_NAME: z.string().default('RSM Messenger'),
  APP_URL: z.string().url().default('http://localhost:5000'),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/rsm_messenger'),

  JWT_SECRET: z.string().min(1).default('rsm_messenger_super_secret_jwt_access_token_key_2026_dev_mode'),
  JWT_REFRESH_SECRET: z.string().min(1).default('rsm_messenger_super_secret_jwt_refresh_token_key_2026_dev_mode'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Unset => ON in development/test (demo OTP 123456 works out of the box), always OFF in production
  MOCK_OTP_ENABLED: z
    .string()
    .optional()
    .transform((val) => (val === undefined || val === '' ? process.env.NODE_ENV !== 'production' : val === 'true')),
  MOCK_OTP_CODE: z.string().default('123456'),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),

  SMS_PROVIDER: z.enum(['mock', 'twilio', 'msg91', 'fast2sms']).default('mock'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  FAST2SMS_API_KEY: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default(path.resolve(__dirname, '../../uploads')),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),

  STUN_SERVERS: z
    .string()
    .default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .transform((val) => val.split(',').map((s) => s.trim())),
  TURN_SERVERS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : [])),
  TURN_USERNAME: z.string().default(''),
  TURN_CREDENTIAL: z.string().default(''),
  TURN_SECRET: z.string().default(''),

  PUSH_PROVIDER: z.enum(['mock', 'expo', 'fcm', 'apns']).default('expo'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000), // 1000 req / 15 min

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173,http://localhost:8081')
    .transform((val) => val.split(',').map((s) => s.trim()))
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    // 1. Refuse mock OTP in production
    if (data.MOCK_OTP_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security error: MOCK_OTP_ENABLED cannot be true in production mode.',
        path: ['MOCK_OTP_ENABLED']
      });
    }

    // 2. Enforce strong JWT secrets in production
    const defaultSecret = 'rsm_messenger_super_secret_jwt_access_token_key_2026_dev_mode';
    const defaultRefresh = 'rsm_messenger_super_secret_jwt_refresh_token_key_2026_dev_mode';

    if (data.JWT_SECRET.length < 32 || data.JWT_SECRET === defaultSecret || data.JWT_SECRET.includes('dev_mode')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security error: JWT_SECRET must be at least 32 characters and cannot use default dev key in production.',
        path: ['JWT_SECRET']
      });
    }

    if (data.JWT_REFRESH_SECRET.length < 32 || data.JWT_REFRESH_SECRET === defaultRefresh || data.JWT_REFRESH_SECRET.includes('dev_mode')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security error: JWT_REFRESH_SECRET must be at least 32 characters and cannot use default dev key in production.',
        path: ['JWT_REFRESH_SECRET']
      });
    }

    // 3. Database must not point to localhost in production
    if (data.MONGODB_URI.includes('localhost') || data.MONGODB_URI.includes('127.0.0.1')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security error: MONGODB_URI cannot point to localhost in production.',
        path: ['MONGODB_URI']
      });
    }

    // 4. CORS origins cannot be empty or wildcard in production
    if (data.CORS_ORIGINS.length === 0 || data.CORS_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Security error: CORS_ORIGINS must specify explicit allowed origins and cannot contain wildcard in production.',
        path: ['CORS_ORIGINS']
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ FATAL: Environment validation failed:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - [${issue.path.join('.') || 'root'}]: ${issue.message}`);
  });
  console.error('\nServer cannot start with invalid environment configuration.\n');
  if (isProduction) {
    process.exit(1);
  } else {
    // In dev / test, log warning or exit if critical
    throw new Error(`Environment validation failed: ${JSON.stringify(parsed.error.issues)}`);
  }
}

export const env = parsed.data;
export type Environment = z.infer<typeof envSchema>;
