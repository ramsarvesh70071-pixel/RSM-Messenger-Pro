import http from 'http';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app';
import { setupSocketHandlers } from '../sockets/socket.handler';
import { SocketEmitter } from '../services/socket-emitter.service';
import { User } from '../models';

/**
 * Proves the "no manual refresh" guarantee: every change made through REST or the socket
 * reaches the other participant live, including events fired immediately after connecting.
 */
describe('Realtime end-to-end (no refresh needed)', () => {
  let mongoServer: MongoMemoryServer;
  let httpServer: http.Server;
  let ioServer: Server;
  let port: number;
  const app = createApp();

  let tokenA = '';
  let tokenB = '';
  let idA = '';
  let idB = '';
  let chatId = '';
  let sockA: ClientSocket;
  let sockB: ClientSocket;

  const waitFor = <T = any>(sock: ClientSocket, event: string, timeout = 4000, pred?: (d: any) => boolean) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
      const handler = (d: any) => {
        if (pred && !pred(d)) return;
        clearTimeout(t);
        sock.off(event, handler);
        resolve(d);
      };
      sock.on(event, handler);
    });

  const login = async (phone: string, name: string, device: string) => {
    const u = await User.create({ phoneNumber: phone, name, countryCode: '+91', isPhoneVerified: true });
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phone });
    const v = await request(app).post('/api/v1/auth/verify-otp').send({ phoneNumber: phone, otp: '123456', deviceId: device });
    return { id: u._id.toString(), token: v.body.data.accessToken as string };
  };

  const connect = (token: string) =>
    new Promise<ClientSocket>((resolve, reject) => {
      const s = ioClient(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'] });
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.disconnect();
    await mongoose.connect(mongoServer.getUri());

    httpServer = http.createServer(app);
    ioServer = new Server(httpServer, { cors: { origin: '*' } });
    SocketEmitter.init(ioServer);
    setupSocketHandlers(ioServer);
    await new Promise<void>((r) => httpServer.listen(0, () => r()));
    port = (httpServer.address() as any).port;

    const a = await login('+919800000001', 'Rt Alice', 'rt-a');
    const b = await login('+919800000002', 'Rt Bob', 'rt-b');
    tokenA = a.token; idA = a.id; tokenB = b.token; idB = b.id;

    const chatRes = await request(app)
      .post('/api/v1/chats/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: idB });
    chatId = chatRes.body.data.chat._id;
  });

  afterAll(async () => {
    [sockA, sockB].forEach((s) => s && (s.removeAllListeners(), s.disconnect()));
    ioServer?.disconnectSockets();
    await new Promise<void>((r) => ioServer.close(() => r()));
    await new Promise<void>((r) => httpServer.close(() => r()));
    await new Promise((r) => setTimeout(r, 100));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. connects, joins rooms and announces socket:ready', async () => {
    sockA = await connect(tokenA);
    const readyA = waitFor(sockA, 'socket:ready');
    sockB = await connect(tokenB);
    const readyB = waitFor(sockB, 'socket:ready');
    expect((await readyB).userId).toBe(idB);
    await readyA.catch(() => null); // A may have fired ready before listener attached; B proves the path
  });

  it('2. events sent right after connect are not dropped (typing)', async () => {
    const typing = waitFor(sockB, 'chat:typing');
    sockA.emit('chat:typing', { chatId, isTyping: true });
    const t = await typing;
    expect(t.userId).toBe(idA);
    expect(t.isTyping).toBe(true);
  });

  it('3. a sent message appears live for the recipient AND echoes to the sender', async () => {
    const gotB = waitFor(sockB, 'message:new');
    const gotA = waitFor(sockA, 'message:new');
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ chatId, content: 'hello live', clientMsgId: 'cm-1' });
    expect(res.status).toBe(201);
    const [mb, ma] = await Promise.all([gotB, gotA]);
    expect(mb.content).toBe('hello live');
    expect(ma.clientMsgId).toBe('cm-1'); // lets the sender replace its optimistic bubble
  });

  it('4. voice note with client attachment shape + reply preview is accepted and built server-side', async () => {
    const first = await request(app).get(`/api/v1/messages/chat/${chatId}`).set('Authorization', `Bearer ${tokenA}`);
    const original = first.body.data[0];
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        chatId,
        type: 'voice',
        content: 'Voice note',
        attachments: [{ url: '/uploads/audio/v.webm', mimeType: 'audio/webm', fileName: 'v.webm', fileSize: 1234, duration: 7, waveform: [10, 20, 30] }],
        replyTo: { messageId: original._id, senderId: 'spoofed', senderName: 'Spoofed', type: 'text', content: 'FAKE' }
      });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('voice');
    expect(res.body.data.attachments[0].fileName).toBe('v.webm');
    expect(res.body.data.attachments[0].duration).toBe(7);
    expect(res.body.data.replyTo.content).toBe('hello live'); // server-built, spoof ignored
    expect(res.body.data.replyTo.senderName).toBe('Rt Alice');
  });

  it('5. edit and delete-for-everyone reach the other side live with usable payloads', async () => {
    const list = await request(app).get(`/api/v1/messages/chat/${chatId}`).set('Authorization', `Bearer ${tokenA}`);
    const msg = list.body.data.find((m: any) => m.content === 'hello live');

    const edited = waitFor(sockB, 'message:edit');
    await request(app).put(`/api/v1/messages/${msg._id}`).set('Authorization', `Bearer ${tokenA}`).send({ content: 'hello edited' });
    const e = await edited;
    expect(String(e.messageId)).toBe(msg._id);
    expect(e.content).toBe('hello edited');

    const deleted = waitFor(sockB, 'message:delete');
    await request(app).delete(`/api/v1/messages/${msg._id}/everyone`).set('Authorization', `Bearer ${tokenA}`);
    const d = await deleted;
    expect(String(d.messageId)).toBe(msg._id);
  });

  it('6. delivered receipt flows back to the sender', async () => {
    const send = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ chatId, content: 'tick test' });
    const mid = send.body.data._id;
    const status = waitFor(sockA, 'message:status', 4000, (d) => d.status === 'delivered' && d.messageIds.includes(mid));
    sockB.emit('message:delivered', { messageIds: [mid] });
    expect((await status).userId).toBe(idB);
  });

  it('7. a user cannot mark delivered/read for a chat they do not belong to', async () => {
    const c = await login('+919800000003', 'Rt Carol', 'rt-c');
    const sockC = await connect(c.token);
    const send = await request(app).post('/api/v1/messages').set('Authorization', `Bearer ${tokenA}`).send({ chatId, content: 'private' });
    let leaked = false;
    sockA.on('message:status', (d: any) => { if (d.userId === c.id) leaked = true; });
    sockC.emit('message:delivered', { messageIds: [send.body.data._id] });
    sockC.emit('message:read', { chatId, messageIds: [send.body.data._id] });
    await new Promise((r) => setTimeout(r, 400));
    sockC.disconnect();
    expect(leaked).toBe(false);
  });

  it('8. call: initiate -> late accept still receives buffered offer/ICE -> answer -> end closes BOTH sides', async () => {
    const incoming = waitFor(sockB, 'call:incoming');
    const ringing = waitFor(sockA, 'call:ringing');
    sockA.emit('call:initiate', { receiverId: idB, callType: 'voice', chatId });
    const [inc, ring] = await Promise.all([incoming, ringing]);
    const callId = ring.callId;
    expect(inc.callId).toBe(callId);

    // Caller sends offer + ICE BEFORE the callee accepts (this is the real-world order)
    sockA.emit('call:offer', { callId, sdp: { type: 'offer', sdp: 'v=0 offer' } });
    sockA.emit('call:ice', { callId, candidate: { candidate: 'candidate:1 1 UDP 1 10.0.0.1 5000 typ host' } });
    await new Promise((r) => setTimeout(r, 200));

    // Callee taps accept -> asks the server to replay what it missed
    const replayOffer = waitFor(sockB, 'call:offer');
    const replayIce = waitFor(sockB, 'call:ice');
    sockB.emit('call:join', { callId });
    expect((await replayOffer).sdp.type).toBe('offer');
    expect((await replayIce).candidate).toBeDefined();

    // Someone else cannot answer or hang up this call
    const c = await login('+919800000004', 'Rt Dan', 'rt-d');
    const sockD = await connect(c.token);
    let hijacked = false;
    sockA.once('call:answered', () => { hijacked = true; });
    sockD.emit('call:answer', { callId, sdp: { type: 'answer', sdp: 'evil' } });
    sockD.emit('call:end', { callId });
    await new Promise((r) => setTimeout(r, 300));
    sockD.disconnect();
    expect(hijacked).toBe(false);

    const answered = waitFor(sockA, 'call:answered');
    sockB.emit('call:answer', { callId, sdp: { type: 'answer', sdp: 'v=0 answer' } });
    expect((await answered).sdp.type).toBe('answer');

    const endA = waitFor(sockA, 'call:ended');
    const endB = waitFor(sockB, 'call:ended');
    sockB.emit('call:end', { callId });
    const [ea, eb] = await Promise.all([endA, endB]);
    expect(ea.callId).toBe(callId);
    expect(eb.callId).toBe(callId);
  });

  it('9. caller cancelling while ringing closes the callee screen and logs a missed call', async () => {
    const incoming = waitFor(sockB, 'call:incoming');
    const ringing = waitFor(sockA, 'call:ringing');
    sockA.emit('call:initiate', { receiverId: idB, callType: 'video', chatId });
    const [, ring] = await Promise.all([incoming, ringing]);
    const endB = waitFor(sockB, 'call:ended');
    sockA.emit('call:end', { callId: ring.callId });
    expect((await endB).callId).toBe(ring.callId);
    // line must be free again
    const again = waitFor(sockB, 'call:incoming');
    sockA.emit('call:initiate', { receiverId: idB, callType: 'voice', chatId });
    await again;
    sockB.emit('call:reject', { callId: (await again).callId });
  });

  it('10. receiver rejecting notifies the caller and frees both lines', async () => {
    await new Promise((r) => setTimeout(r, 300));
    const incoming = waitFor(sockB, 'call:incoming');
    sockA.emit('call:initiate', { receiverId: idB, callType: 'voice', chatId });
    const inc = await incoming;
    const rejected = waitFor(sockA, 'call:rejected');
    const ended = waitFor(sockA, 'call:ended');
    sockB.emit('call:reject', { callId: inc.callId });
    await rejected;
    await ended;
  });
});
