import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Chat, Message, Otp } from '../models';

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

describe('Phase 2 - Message Pipeline & Features Test Suite', () => {
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let chatDirectId: string;
  let groupChatId: string;

  beforeAll(async () => {
    // User 1
    const user1 = await User.create({
      phoneNumber: '+919111111111',
      name: 'Alice',
      role: 'user',
      isPhoneVerified: true
    });
    user1Id = user1._id.toString();

    // User 2
    const user2 = await User.create({
      phoneNumber: '+919222222222',
      name: 'Bob',
      role: 'user',
      isPhoneVerified: true
    });
    user2Id = user2._id.toString();

    // Log in User 1
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: '+919111111111' });
    const verify1 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919111111111', otp: '123456', deviceId: 'alice_phone' });
    user1Token = verify1.body.data.accessToken;

    // Log in User 2
    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: '+919222222222' });
    const verify2 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: '+919222222222', otp: '123456', deviceId: 'bob_phone' });
    user2Token = verify2.body.data.accessToken;

    // Direct chat between Alice and Bob
    const directChatRes = await request(app)
      .post('/api/v1/chats/direct')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ targetUserId: user2Id });
    chatDirectId = directChatRes.body.data.chat._id;

    // Group chat with Alice as owner, Bob as member
    const groupRes = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Project Group', memberIds: [user2Id] });
    groupChatId = groupRes.body.data._id;
  });

  // --------------------------------------------------------------------------
  // 1. Send Message & Idempotency (clientMsgId)
  // --------------------------------------------------------------------------
  it('1. Send message creates message with status "sent" and stores clientMsgId', async () => {
    const clientMsgId = 'uuid-msg-12345';
    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        chatId: chatDirectId,
        content: 'Hello Bob!',
        type: 'text',
        clientMsgId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Hello Bob!');
    expect(res.body.data.status).toBe('sent');
    expect(res.body.data.clientMsgId).toBe(clientMsgId);

    // Sending again with the same clientMsgId must be idempotent (return 200, not create duplicate)
    const retryRes = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        chatId: chatDirectId,
        content: 'Hello Bob! (retry)',
        type: 'text',
        clientMsgId
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data._id).toBe(res.body.data._id);
    expect(retryRes.body.data.content).toBe('Hello Bob!'); // content preserved from first send

    // Verify count in DB is still 1
    const count = await Message.countDocuments({ chatId: chatDirectId, clientMsgId });
    expect(count).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 2. Delivery & Read Receipts Pipeline
  // --------------------------------------------------------------------------
  it('2. Transition status: sent -> delivered -> read', async () => {
    // Alice sends a new message
    const sendRes = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        chatId: chatDirectId,
        content: 'Tick test message',
        type: 'text'
      });
    const messageId = sendRes.body.data._id;
    expect(sendRes.body.data.status).toBe('sent');

    // Bob marks as delivered
    const deliverRes = await request(app)
      .post('/api/v1/messages/delivered')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ messageIds: [messageId] });
    expect(deliverRes.status).toBe(200);

    const deliveredMsg = await Message.findById(messageId);
    expect(deliveredMsg?.status).toBe('delivered');
    expect(deliveredMsg?.deliveredTo.some((d) => d.userId.toString() === user2Id)).toBe(true);

    // Bob marks as read
    const readRes = await request(app)
      .post('/api/v1/messages/read')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ chatId: chatDirectId, messageIds: [messageId] });
    expect(readRes.status).toBe(200);

    const readMsg = await Message.findById(messageId);
    expect(readMsg?.status).toBe('read');
    expect(readMsg?.readBy.some((r) => r.userId.toString() === user2Id)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. Cursor Pagination (before=<id>&limit=N)
  // --------------------------------------------------------------------------
  it('3. Cursor pagination returns chronological messages with nextCursor and hasMore', async () => {
    // Seed 10 sequential messages
    const createdMsgIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const msg = await Message.create({
        chatId: chatDirectId,
        senderId: user1Id,
        content: `Bulk message #${i}`,
        type: 'text',
        status: 'sent'
      });
      createdMsgIds.push(msg._id.toString());
    }

    // Fetch page of 5 without cursor (gets latest 5)
    const res1 = await request(app)
      .get(`/api/v1/messages/chat/${chatDirectId}?limit=5`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(5);
    expect(res1.body.pagination.hasMore).toBe(true);
    const oldestInPage1 = res1.body.data[0]._id;

    // Fetch next page using before cursor
    const res2 = await request(app)
      .get(`/api/v1/messages/chat/${chatDirectId}?before=${oldestInPage1}&limit=5`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBeGreaterThan(0);
    // Messages should not overlap
    const idsPage1 = new Set(res1.body.data.map((m: any) => m._id));
    const idsPage2 = res2.body.data.map((m: any) => m._id);
    for (const id of idsPage2) {
      expect(idsPage1.has(id)).toBe(false);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Message Edit & Delete Time Limits
  // --------------------------------------------------------------------------
  it('4. Message editing within 15 min succeeds; edit after 15 min window fails', async () => {
    // Recent message (can be edited)
    const recentMsg = await Message.create({
      chatId: chatDirectId,
      senderId: user1Id,
      content: 'Original message',
      type: 'text',
      createdAt: new Date()
    });

    const editRes = await request(app)
      .put(`/api/v1/messages/${recentMsg._id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ content: 'Edited message' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.data.content).toBe('Edited message');
    expect(editRes.body.data.isEdited).toBe(true);

    // Old message created 20 minutes ago (cannot be edited)
    const oldMsg = await Message.create({
      chatId: chatDirectId,
      senderId: user1Id,
      content: 'Old text',
      type: 'text',
      createdAt: new Date(Date.now() - 20 * 60 * 1000)
    });

    const oldEditRes = await request(app)
      .put(`/api/v1/messages/${oldMsg._id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ content: 'Try to edit old' });

    expect(oldEditRes.status).toBe(400);
    expect(oldEditRes.body.message).toMatch(/window expired/i);
  });

  it('5. Group Admin can delete other member\'s message for everyone', async () => {
    // Bob (regular member) sends a message in group
    const bobMsg = await Message.create({
      chatId: groupChatId,
      senderId: user2Id,
      content: 'Bob message in group',
      type: 'text',
      status: 'sent'
    });

    // Alice (Group Admin) deletes Bob's message for everyone
    const adminDeleteRes = await request(app)
      .delete(`/api/v1/messages/${bobMsg._id}/everyone`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(adminDeleteRes.status).toBe(200);

    const deletedInDb = await Message.findById(bobMsg._id);
    expect(deletedInDb?.isDeletedForEveryone).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Message Forwarding
  // --------------------------------------------------------------------------
  it('6. Forward message copies reference, marks isForwarded, and enforces max 5 chats', async () => {
    const srcMsg = await Message.create({
      chatId: chatDirectId,
      senderId: user1Id,
      content: 'Forward this news',
      type: 'text'
    });

    // Forwarding to > 5 chats should be rejected
    const dummyChatIds = Array(6).fill(chatDirectId);
    const rejectRes = await request(app)
      .post('/api/v1/messages/forward')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        messageIds: [srcMsg._id.toString()],
        targetChatIds: dummyChatIds
      });
    expect(rejectRes.status).toBe(400);

    // Forwarding to groupChatId (valid)
    const validFwd = await request(app)
      .post('/api/v1/messages/forward')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        messageIds: [srcMsg._id.toString()],
        targetChatIds: [groupChatId]
      });

    expect(validFwd.status).toBe(200);
    expect(validFwd.body.data.length).toBe(1);
    expect(validFwd.body.data[0].content).toBe('Forward this news');
    expect(validFwd.body.data[0].isForwarded).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. Search & Jump to Context
  // --------------------------------------------------------------------------
  it('7. Search messages within chat and jump to message context', async () => {
    const uniqueWord = 'Supercalifragilistic77';
    const targetMsg = await Message.create({
      chatId: chatDirectId,
      senderId: user1Id,
      content: `Here is the secret code ${uniqueWord}`,
      type: 'text'
    });

    // Search
    const searchRes = await request(app)
      .get(`/api/v1/messages/search?chatId=${chatDirectId}&query=${uniqueWord}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
    expect(searchRes.body.data[0].content).toContain(uniqueWord);

    // Context Jump
    const contextRes = await request(app)
      .get(`/api/v1/messages/chat/${chatDirectId}/context/${targetMsg._id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(contextRes.status).toBe(200);
    expect(Array.isArray(contextRes.body.data)).toBe(true);
    expect(contextRes.body.data.some((m: any) => m._id === targetMsg._id.toString())).toBe(true);
  });
});
