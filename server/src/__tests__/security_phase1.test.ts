import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Otp, Chat, Message } from '../models';

let mongoServer: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 1 - Security Hardening & IDOR Test Suite', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let adminToken: string;
  let adminId: string;

  let chatAId: string;
  let messageAId: string;

  beforeAll(async () => {
    // Seed User A (+919876543211)
    const userA = await User.create({
      phoneNumber: '+919876543211',
      name: 'User A',
      role: 'user',
      isPhoneVerified: true
    });
    userAId = userA._id.toString();

    // Seed User B (+919876543212)
    const userB = await User.create({
      phoneNumber: '+919876543212',
      name: 'User B',
      role: 'user',
      isPhoneVerified: true
    });
    userBId = userB._id.toString();

    // Seed Admin (+919876543210)
    const admin = await User.create({
      phoneNumber: '+919876543210',
      name: 'Admin User',
      role: 'admin',
      isPhoneVerified: true
    });
    adminId = admin._id.toString();

    // Log in User A
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: '+919876543211' });
    const otpDocA = await Otp.findOne({ phoneNumber: '+919876543211' });
    const verifyA = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919876543211', otp: '123456', deviceId: 'dev_a' });
    userAToken = verifyA.body.data.accessToken;

    // Log in User B
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: '+919876543212' });
    const verifyB = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919876543212', otp: '123456', deviceId: 'dev_b' });
    userBToken = verifyB.body.data.accessToken;

    // Log in Admin
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: '+919876543210' });
    const verifyAdmin = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919876543210', otp: '123456', deviceId: 'dev_admin' });
    adminToken = verifyAdmin.body.data.accessToken;

    // Create a private direct chat for User A with another third user
    const thirdUser = await User.create({
      phoneNumber: '+919876543213',
      name: 'Third User',
      role: 'user'
    });
    const chatA = await Chat.create({
      type: 'direct',
      participants: [userA._id, thirdUser._id],
      membersMeta: [
        { userId: userA._id, role: 'member', unreadCount: 0 },
        { userId: thirdUser._id, role: 'member', unreadCount: 0 }
      ],
      createdBy: userA._id
    });
    chatAId = chatA._id.toString();

    const messageA = await Message.create({
      chatId: chatA._id,
      senderId: userA._id,
      type: 'text',
      content: 'Confidential message in Chat A',
      status: 'sent'
    });
    messageAId = messageA._id.toString();
  });

  // --------------------------------------------------------------------------
  // S1/S3: OTP Verification & Brute-Force Limits
  // --------------------------------------------------------------------------
  it('1. S3: Repeated wrong OTP attempts should increment attempts and reject on 6th attempt', async () => {
    const testPhone = '+919999988888';
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: testPhone });

    // Send 5 wrong attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phoneNumber: testPhone, otp: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }

    // 6th attempt should return maximum attempts exceeded and OTP should be deleted
    const res6 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: testPhone, otp: '123456' }); // even correct OTP should now fail
    expect(res6.status).toBe(400);
    expect(res6.body.message).toMatch(/too many failed attempts|invalid or expired otp/i);

    const remainingOtp = await Otp.findOne({ phoneNumber: testPhone });
    expect(remainingOtp).toBeNull();
  });

  // --------------------------------------------------------------------------
  // S6: IDOR - User B cannot access or modify User A's chat/messages
  // --------------------------------------------------------------------------
  it('2. S6: User B cannot get messages from Chat A (IDOR)', async () => {
    const res = await request(app)
      .get(`/api/v1/messages/chat/${chatAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('3. S6: User B cannot react to message in Chat A (IDOR)', async () => {
    const res = await request(app)
      .post(`/api/v1/messages/${messageAId}/react`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ emoji: '👍' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('4. S6: User B cannot star or pin message in Chat A (IDOR)', async () => {
    const starRes = await request(app)
      .post(`/api/v1/messages/${messageAId}/star`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(starRes.status).toBe(403);

    const pinRes = await request(app)
      .post(`/api/v1/messages/${messageAId}/pin`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ pin: true });

    expect(pinRes.status).toBe(403);
  });

  it('5. S6: User B cannot change disappearing messages config on Chat A (IDOR)', async () => {
    const res = await request(app)
      .post(`/api/v1/chats/${chatAId}/disappearing`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ enabled: true, durationSeconds: 3600 });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // --------------------------------------------------------------------------
  // S7: Device / Session Revocation
  // --------------------------------------------------------------------------
  it('6. S7: Revoking session/logging out invalidates token immediately (401)', async () => {
    // User A logs out
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(logoutRes.status).toBe(200);

    // Subsequent call with the revoked token must return 401
    const profileRes = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(profileRes.status).toBe(401);
    expect(profileRes.body.message).toMatch(/revoked|expired/i);
  });

  // --------------------------------------------------------------------------
  // S9: Safe Regex (No ReDoS / Unhandled 500)
  // --------------------------------------------------------------------------
  it('7. S9: Searching with invalid regex characters returns 200, never 500', async () => {
    const malformedQueries = ['[abc(', '(?=.*)', '***', '++++', '\\\\\\'];

    for (const q of malformedQueries) {
      const res = await request(app)
        .get(`/api/v1/users?q=${encodeURIComponent(q)}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  // --------------------------------------------------------------------------
  // S10: Upload Magic-Byte Validation
  // --------------------------------------------------------------------------
  it('8. S10: Upload claiming image/png with invalid content is rejected (400)', async () => {
    const fakeImageBuffer = Buffer.from('THIS IS NOT A PNG IMAGE');

    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${userBToken}`)
      .attach('file', fakeImageBuffer, {
        filename: 'fake_malicious.png',
        contentType: 'image/png'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/spoofed file|does not match/i);
  });

  // --------------------------------------------------------------------------
  // S12: Admin Safety
  // --------------------------------------------------------------------------
  it('9. S12: Admin cannot suspend themselves or another admin', async () => {
    // Admin attempts to suspend themselves
    const selfRes = await request(app)
      .post(`/api/v1/admin/users/${adminId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSuspended: true });

    expect(selfRes.status).toBe(400);
    expect(selfRes.body.message).toMatch(/cannot suspend your own account/i);

    // Create a second admin
    const secondAdmin = await User.create({
      phoneNumber: '+919876543299',
      name: 'Second Admin',
      role: 'admin'
    });

    const otherAdminRes = await request(app)
      .post(`/api/v1/admin/users/${secondAdmin._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSuspended: true });

    expect(otherAdminRes.status).toBe(403);
    expect(otherAdminRes.body.message).toMatch(/cannot suspend another admin/i);
  });
});
