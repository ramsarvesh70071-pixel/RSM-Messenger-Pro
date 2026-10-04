import http from 'http';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { setupSocketHandlers } from '../sockets/socket.handler';
import { User, Call, BlockedUser } from '../models';
import { env } from '../config/environment';

describe('Phase 4 - WebRTC Calling & Signaling Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: http.Server;
  let ioServer: Server;
  let serverPort: number;

  const app = createApp();

  let userAToken: string;
  let userBToken: string;
  let userCToken: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;

  let socketA: ClientSocket;
  let socketB: ClientSocket;
  let socketC: ClientSocket;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);

    // Create test HTTP & Socket.IO server
    httpServer = http.createServer(app);
    ioServer = new Server(httpServer, {
      cors: { origin: '*' }
    });
    setupSocketHandlers(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
        }
        resolve();
      });
    });

    // Create User A
    const phoneA = '+919876540001';
    const userA = await User.create({
      phoneNumber: phoneA,
      name: 'Alice Call',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userAId = userA._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneA });
    const verifyA = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneA, otp: '123456', deviceId: 'device-call-a' });
    userAToken = verifyA.body.data.accessToken;

    // Create User B
    const phoneB = '+919876540002';
    const userB = await User.create({
      phoneNumber: phoneB,
      name: 'Bob Call',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userBId = userB._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneB });
    const verifyB = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneB, otp: '123456', deviceId: 'device-call-b' });
    userBToken = verifyB.body.data.accessToken;

    // Create User C
    const phoneC = '+919876540003';
    const userC = await User.create({
      phoneNumber: phoneC,
      name: 'Charlie Call',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userCId = userC._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneC });
    const verifyC = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneC, otp: '123456', deviceId: 'device-call-c' });
    userCToken = verifyC.body.data.accessToken;
  });

  afterAll(async () => {
    if (socketA) {
      socketA.removeAllListeners();
      socketA.disconnect();
    }
    if (socketB) {
      socketB.removeAllListeners();
      socketB.disconnect();
    }
    if (socketC) {
      socketC.removeAllListeners();
      socketC.disconnect();
    }
    if (ioServer) {
      ioServer.disconnectSockets();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // 1. ICE Servers & TURN REST HMAC test
  describe('1. ICE Servers & TURN Credentials', () => {
    it('returns STUN and TURN server configurations with time-limited HMAC credentials', async () => {
      // Temporarily set TURN settings
      const origSecret = env.TURN_SECRET;
      const origServers = env.TURN_SERVERS;
      (env as any).TURN_SECRET = 'super-secret-turn-key-32-chars-long!!';
      (env as any).TURN_SERVERS = ['turn:turn.example.com:3478?transport=udp'];

      const res = await request(app)
        .get('/api/v1/calls/ice-servers')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.iceServers)).toBe(true);

      const turnEntry = res.body.data.iceServers.find((s: any) => s.urls.includes('turn:turn.example.com'));
      expect(turnEntry).toBeDefined();
      expect(turnEntry.username).toContain(`:${userAId}`);
      expect(turnEntry.credential).toBeDefined();

      // Restore
      (env as any).TURN_SECRET = origSecret;
      (env as any).TURN_SERVERS = origServers;
    });
  });

  // 2. Call Log REST CRUD & IDOR validation
  describe('2. Call Log REST Endpoints', () => {
    let callLogId: string;

    it('creates a call log entry via POST /calls/log', async () => {
      const res = await request(app)
        .post('/api/v1/calls/log')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          receiverId: userBId,
          callType: 'video',
          duration: 45
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.callType).toBe('video');
      callLogId = res.body.data._id;
    });

    it('updates call log status and duration via PUT /calls/log/:id', async () => {
      const res = await request(app)
        .put(`/api/v1/calls/log/${callLogId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          status: 'ended',
          durationSeconds: 120
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ended');
      expect(res.body.data.durationSeconds).toBe(120);
    });

    it('enforces IDOR: non-participant User C cannot update or delete the call log', async () => {
      const updateRes = await request(app)
        .put(`/api/v1/calls/log/${callLogId}`)
        .set('Authorization', `Bearer ${userCToken}`)
        .send({ status: 'rejected' });

      expect(updateRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/v1/calls/log/${callLogId}`)
        .set('Authorization', `Bearer ${userCToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });

  // 3. Socket WebRTC Signaling Suite
  describe('3. WebRTC Socket.IO Signaling State Machine', () => {
    beforeAll((done) => {
      let connectedCount = 0;
      const checkDone = () => {
        connectedCount++;
        if (connectedCount === 3) done();
      };

      socketA = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: userAToken },
        transports: ['websocket']
      });
      socketA.on('connect', checkDone);

      socketB = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: userBToken },
        transports: ['websocket']
      });
      socketB.on('connect', checkDone);

      socketC = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: userCToken },
        transports: ['websocket']
      });
      socketC.on('connect', checkDone);
    });



    it('S14: blocks call initiation if caller is blocked by callee', async () => {
      await BlockedUser.create({ userId: userBId, blockedUserId: userAId });

      const errorPromise = new Promise<any>((resolve) => {
        socketA.once('call:error', resolve);
      });

      socketA.emit('call:initiate', { receiverId: userBId, callType: 'voice' });

      const err = await errorPromise;
      expect(err.message).toMatch(/unavailable/i);

      await BlockedUser.deleteMany({ userId: userBId, blockedUserId: userAId });
    });

    it('enforces privacySettings.allowCalls = "nobody"', async () => {
      await User.findByIdAndUpdate(userBId, { 'privacySettings.allowCalls': 'nobody' });

      const errorPromise = new Promise<any>((resolve) => {
        socketA.once('call:error', resolve);
      });

      socketA.emit('call:initiate', { receiverId: userBId, callType: 'voice' });

      const err = await errorPromise;
      expect(err.message).toMatch(/does not accept calls/i);

      await User.findByIdAndUpdate(userBId, { 'privacySettings.allowCalls': 'everyone' });
    });

    it('initiates call, transmits ringing and incoming events, and verifies DB row', async () => {
      let activeCallId = '';

      const ringingPromise = new Promise<any>((resolve) => {
        socketA.once('call:ringing', (data) => {
          activeCallId = data.callId;
          resolve(data);
        });
      });

      const incomingPromise = new Promise<any>((resolve) => {
        socketB.once('call:incoming', resolve);
      });

      socketA.emit('call:initiate', { receiverId: userBId, callType: 'video' });

      const [ringingData, incomingData] = await Promise.all([ringingPromise, incomingPromise]);

      expect(ringingData.callId).toBeDefined();
      expect(ringingData.receiverId).toBe(userBId);
      expect(incomingData.callId).toBe(activeCallId);
      expect(incomingData.callType).toBe('video');
      expect(incomingData.caller._id).toBe(userAId);

      const dbCall = await Call.findById(activeCallId);
      expect(dbCall).toBeDefined();
      expect(dbCall?.status).toBe('ringing');

      // Test Busy state: User C calls User B while User B is ringing
      const busyPromise = new Promise<any>((resolve) => {
        socketC.once('call:busy', resolve);
      });

      socketC.emit('call:initiate', { receiverId: userBId, callType: 'voice' });
      const busyData = await busyPromise;
      expect(busyData.message).toMatch(/another call/i);

      // Verify a busy call log was recorded in DB
      const busyCallDoc = await Call.findOne({ caller: userCId, receiver: userBId, status: 'busy' });
      expect(busyCallDoc).toBeDefined();

      // Test Signaling: Offer & Answer
      const offerPromise = new Promise<any>((resolve) => {
        socketB.once('call:offer', resolve);
      });

      socketA.emit('call:offer', {
        callId: activeCallId,
        receiverId: userBId,
        sdp: { type: 'offer', sdp: 'v=0\r\no=alice 12345 12345 IN IP4 127.0.0.1' }
      });

      const offerReceived = await offerPromise;
      expect(offerReceived.sdp.type).toBe('offer');
      expect(offerReceived.senderId).toBe(userAId);

      // Answer call
      const answeredPromise = new Promise<any>((resolve) => {
        socketA.once('call:answered', resolve);
      });

      socketB.emit('call:answer', {
        callId: activeCallId,
        callerId: userAId,
        sdp: { type: 'answer', sdp: 'v=0\r\no=bob 67890 67890 IN IP4 127.0.0.1' }
      });

      const answeredData = await answeredPromise;
      expect(answeredData.sdp.type).toBe('answer');

      const connectedCall = await Call.findById(activeCallId);
      expect(connectedCall?.status).toBe('connected');

      // Test ICE Candidate exchange
      const icePromise = new Promise<any>((resolve) => {
        socketB.once('call:ice', resolve);
      });

      socketA.emit('call:ice', {
        callId: activeCallId,
        targetUserId: userBId,
        candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host' }
      });

      const iceData = await icePromise;
      expect(iceData.candidate).toBeDefined();

      // End Call
      const endPromiseA = new Promise<any>((resolve) => {
        socketA.once('call:ended', resolve);
      });
      const endPromiseB = new Promise<any>((resolve) => {
        socketB.once('call:ended', resolve);
      });

      socketA.emit('call:end', { callId: activeCallId });

      await Promise.all([endPromiseA, endPromiseB]);

      const endedCall = await Call.findById(activeCallId);
      expect(endedCall?.status).toBe('ended');
      expect(endedCall?.durationSeconds).toBeDefined();
      expect(endedCall?.endedAt).toBeDefined();
    });
  });
});
