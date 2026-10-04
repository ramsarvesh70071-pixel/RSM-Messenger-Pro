import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Chat, Message, Call, Status, Device } from '../models';

describe('Phase 3 - Mobile Contract Compatibility Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let createdDirectChatId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);

    // Create User A
    const phoneA = '+919999900001';
    const userA = await User.create({
      phoneNumber: phoneA,
      name: 'Mobile User A',
      countryCode: '+91',
      isPhoneVerified: true,
    });
    userAId = userA._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneA });
    const verifyA = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneA, otp: '123456', deviceId: 'mobile-device-a' });
    userAToken = verifyA.body.data.accessToken;

    // Create User B
    const phoneB = '+919999900002';
    const userB = await User.create({
      phoneNumber: phoneB,
      name: 'Mobile User B',
      countryCode: '+91',
      isPhoneVerified: true,
    });
    userBId = userB._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneB });
    const verifyB = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneB, otp: '123456', deviceId: 'mobile-device-b' });
    userBToken = verifyB.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Contract 1: POST /chats/direct with { recipientId }
  it('1. POST /chats/direct accepts { recipientId } from mobile and returns { chat, isBlocked }', async () => {
    const res = await request(app)
      .post('/api/v1/chats/direct')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ recipientId: userBId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.chat).toBeDefined();
    expect(res.body.data.isBlocked).toBe(false);
    createdDirectChatId = res.body.data.chat._id.toString();
    const participantIds = res.body.data.chat.participants.map((p: any) => (p._id || p).toString());
    expect(participantIds).toContain(userBId);
  });

  // Contract 2: POST /groups with { name, participantIds, description }
  it('2. POST /groups accepts { participantIds } and creates group with all members', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Mobile Dev Group',
        participantIds: [userBId],
        description: 'Test group description',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const group = res.body.data;
    expect(group.name).toBe('Mobile Dev Group');
    expect(group.participants.length).toBe(2);
    const participantIds = group.participants.map((p: any) => (p._id || p).toString());
    expect(participantIds).toContain(userBId);
  });

  // Contract 3: POST /status with { text, mediaUrl, type }
  it('3. POST /status accepts { text, mediaUrl, type } without requiring "content"', async () => {
    const res = await request(app)
      .post('/api/v1/status')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'text',
        text: 'Hello from mobile status story!',
        backgroundColor: '#25D366',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Hello from mobile status story!');
  });

  // Contract 4: POST /messages with mediaUrl or attachments
  it('4. POST /messages properly saves attachments from mediaUrl or attachments[]', async () => {
    expect(createdDirectChatId).toBeDefined();

    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        chatId: createdDirectChatId,
        content: 'Check this media',
        type: 'image',
        mediaUrl: '/uploads/images/sample-pic.jpg',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attachments).toBeDefined();
    expect(res.body.data.attachments.length).toBeGreaterThan(0);
    expect(res.body.data.attachments[0].url).toBe('/uploads/images/sample-pic.jpg');
  });

  // Contract 5: POST /calls/log with { receiverId, callType, status: 'completed', duration: 42 }
  it('5. POST /calls/log accepts status: "completed" and maps to "ended" with duration', async () => {
    const res = await request(app)
      .post('/api/v1/calls/log')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        receiverId: userBId,
        callType: 'voice',
        status: 'completed',
        duration: 42,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const callLog = res.body.data;
    expect(callLog.status).toBe('ended');
    expect(callLog.duration).toBe(42);
  });

  // Contract 6: PUT /devices/push-token with { pushToken, deviceId }
  it('6. PUT /devices/push-token successfully updates device pushToken', async () => {
    const res = await request(app)
      .put('/api/v1/devices/push-token')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        deviceId: 'mobile-device-a',
        deviceName: 'Pixel 8 Pro',
        deviceType: 'android',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dev = await Device.findOne({ userId: userAId, deviceId: 'mobile-device-a' });
    expect(dev).toBeDefined();
    expect(dev!.pushToken).toBe('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    expect(dev!.deviceName).toBe('Pixel 8 Pro');
  });
});
