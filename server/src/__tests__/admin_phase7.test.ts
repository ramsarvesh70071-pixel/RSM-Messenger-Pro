import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Message, Chat, Report, AuditLog } from '../models';

describe('Phase 7 - Admin Panel Completion Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let adminToken: string;
  let adminId: string;

  let regularUserToken: string;
  let regularUserId: string;

  let anotherAdminToken: string;
  let anotherAdminId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);

    // Create Main Admin
    const phoneAdmin = '+919876543210';
    const admin = await User.create({
      phoneNumber: phoneAdmin,
      name: 'Super Admin',
      countryCode: '+91',
      role: 'admin',
      isPhoneVerified: true
    });
    adminId = admin._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneAdmin });
    const verifyAdmin = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneAdmin, otp: '123456', deviceId: 'admin-dev-1' });
    adminToken = verifyAdmin.body.data.accessToken;

    // Create Regular User
    const phoneUser = '+919999222201';
    const regUser = await User.create({
      phoneNumber: phoneUser,
      name: 'Regular Bob',
      countryCode: '+91',
      role: 'user',
      isPhoneVerified: true
    });
    regularUserId = regUser._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneUser });
    const verifyUser = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneUser, otp: '123456', deviceId: 'user-dev-1' });
    regularUserToken = verifyUser.body.data.accessToken;

    // Create Secondary Admin
    const phoneAdmin2 = '+919876543219';
    const admin2 = await User.create({
      phoneNumber: phoneAdmin2,
      name: 'Second Admin',
      countryCode: '+91',
      role: 'admin',
      isPhoneVerified: true
    });
    anotherAdminId = admin2._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneAdmin2 });
    const verifyAdmin2 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneAdmin2, otp: '123456', deviceId: 'admin-dev-2' });
    anotherAdminToken = verifyAdmin2.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // 1. Role Enforcement
  describe('1. Role Access Control', () => {
    it('denies access to non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
    });

    it('grants access to admin users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 2. Real Storage Stats & User Details
  describe('2. Dashboard Stats & User Details', () => {
    it('returns dashboard stats with real storage aggregation from attachments', async () => {
      // Seed a message with attachment
      const chat = await Chat.create({
        type: 'direct',
        participants: [adminId, regularUserId],
        createdBy: adminId
      });

      await Message.create({
        chatId: chat._id,
        senderId: adminId,
        type: 'document',
        content: 'File doc',
        attachments: [
          {
            url: '/uploads/docs/spec.pdf',
            mimeType: 'application/pdf',
            fileName: 'spec.pdf',
            fileSize: 2097152 // 2 MB
          }
        ],
        status: 'sent'
      });

      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.storageStats.totalStorageBytes).toBeGreaterThanOrEqual(2097152);
      expect(res.body.data.storageStats.totalStorageMb).toBeGreaterThanOrEqual(2);
    });

    it('returns user details with devices, activity, and reports', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${regularUserId}/details`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.phoneNumber).toBe('+919999222201');
      expect(res.body.data.devices.length).toBeGreaterThan(0);
      expect(res.body.data.activity.totalChats).toBeGreaterThan(0);
    });
  });

  // 3. Admin Safety & User Suspension
  describe('3. Admin Safety & User Suspension', () => {
    it('prevents an admin from suspending themselves (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${adminId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspend: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot suspend your own account/i);
    });

    it('prevents an admin from suspending another admin (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${anotherAdminId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspend: true });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/cannot suspend another administrator/i);
    });

    it('suspends regular user and revokes their active sessions', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspend: true, reason: 'Repeated terms violations', durationDays: 7 });

      expect(res.status).toBe(200);

      // Verify regular user is now suspended
      const userDoc = await User.findById(regularUserId);
      expect(userDoc?.isSuspended).toBe(true);

      // Unsuspend for further tests
      await request(app)
        .post(`/api/v1/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ suspend: false });
    });
  });

  // 4. Broadcast Announcement
  describe('4. Broadcast System Announcement', () => {
    it('broadcasts announcement to all active users', async () => {
      const res = await request(app)
        .post('/api/v1/admin/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'System Maintenance Window',
          content: 'Scheduled maintenance tonight from 2 AM to 3 AM UTC.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.recipientsCount).toBeGreaterThan(0);
    });
  });

  // 5. Reports Workflow with One-Click Actions
  describe('5. Abuse Reports Workflow', () => {
    it('resolves abuse report with one-click suspend action', async () => {
      // Create user to be reported
      const badUser = await User.create({
        phoneNumber: '+919999333333',
        name: 'Malicious Bot',
        countryCode: '+91',
        isPhoneVerified: true
      });

      const report = await Report.create({
        reporterId: regularUserId,
        targetType: 'user',
        targetId: badUser._id,
        reason: 'Automated spam',
        status: 'pending'
      });

      const resolveRes = await request(app)
        .post(`/api/v1/admin/reports/${report._id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          action: 'suspend_user',
          adminNotes: 'Verified spam bot behavior'
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.status).toBe('resolved');

      // Verify badUser was suspended by the one-click action
      const checkedUser = await User.findById(badUser._id);
      expect(checkedUser?.isSuspended).toBe(true);
    });
  });

  // 6. System Health & Real MongoDB Ping
  describe('6. System Health & Audit Logging', () => {
    it('returns system health with database connected and valid ping', async () => {
      const res = await request(app)
        .get('/api/v1/admin/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.database).toBe('connected');
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data.mongoPingMs).toBeGreaterThanOrEqual(0);
    });

    it('records and returns audit logs for admin actions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const hasBroadcastAction = res.body.data.some((l: any) => l.action === 'broadcast_announcement');
      expect(hasBroadcastAction).toBe(true);
    });
  });
});
