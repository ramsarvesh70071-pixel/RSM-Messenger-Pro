import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Chat } from '../models';

let mongoServer: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Seed user and chat
  const user = await User.create({
    phoneNumber: '+919876543210',
    name: 'Admin User',
    role: 'admin',
    isPhoneVerified: true
  });

  const otherUser = await User.create({
    phoneNumber: '+919876543219',
    name: 'Friend',
    role: 'user'
  });

  await Chat.create({
    type: 'direct',
    participants: [user._id, otherUser._id],
    membersMeta: [
      { userId: user._id, role: 'member', unreadCount: 0 },
      { userId: otherUser._id, role: 'member', unreadCount: 0 }
    ],
    createdBy: user._id
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('RSM Messenger API & Auth Test Suite', () => {
  let accessToken: string;
  let userId: string;

  it('1. GET /health - should return UP status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.app).toBe('RSM Messenger');
  });

  it('2. POST /api/v1/auth/request-otp - should send mock OTP for phone number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/request-otp')
      .send({ phoneNumber: '+919876543210' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mockOtp).toBe('123456');
  });

  it('3. POST /api/v1/auth/verify-otp - should reject invalid OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919876543210', otp: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. POST /api/v1/auth/verify-otp - should authenticate with valid OTP and return JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        phoneNumber: '+919876543210',
        otp: '123456',
        deviceId: 'test_jest_device',
        deviceName: 'Jest Test Runner'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    accessToken = res.body.data.accessToken;
    userId = res.body.data.user._id;
  });

  it('5. GET /api/v1/users/profile - should fail without Bearer token', async () => {
    const res = await request(app).get('/api/v1/users/profile');
    expect(res.status).toBe(401);
  });

  it('6. GET /api/v1/users/profile - should return current user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phoneNumber).toBe('+919876543210');
  });

  it('7. GET /api/v1/chats - should return seeded chats list', async () => {
    const res = await request(app)
      .get('/api/v1/chats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('8. GET /api/v1/calls/ice-servers - should return STUN configuration', async () => {
    const res = await request(app)
      .get('/api/v1/calls/ice-servers')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.iceServers).toBeDefined();
    expect(res.body.data.iceServers.length).toBeGreaterThan(0);
  });
});
