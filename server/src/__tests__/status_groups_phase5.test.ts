import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app';
import { User, Chat, Status, Community, Channel, ChannelPost, Contact, Message, Report } from '../models';

describe('Phase 5 - Status, Groups, Communities, Channels & Contacts Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let userAToken: string;
  let userBToken: string;
  let userCToken: string;

  let userAId: string;
  let userBId: string;
  let userCId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);

    // Create User A
    const phoneA = '+919999111101';
    const userA = await User.create({
      phoneNumber: phoneA,
      name: 'Alice Group',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userAId = userA._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneA });
    const verifyA = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneA, otp: '123456', deviceId: 'dev-a-phase5' });
    userAToken = verifyA.body.data.accessToken;

    // Create User B
    const phoneB = '+919999111102';
    const userB = await User.create({
      phoneNumber: phoneB,
      name: 'Bob Group',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userBId = userB._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneB });
    const verifyB = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneB, otp: '123456', deviceId: 'dev-b-phase5' });
    userBToken = verifyB.body.data.accessToken;

    // Create User C
    const phoneC = '+919999111103';
    const userC = await User.create({
      phoneNumber: phoneC,
      name: 'Charlie Group',
      countryCode: '+91',
      isPhoneVerified: true
    });
    userCId = userC._id.toString();

    await request(app).post('/api/v1/auth/request-otp').send({ phoneNumber: phoneC });
    const verifyC = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phoneNumber: phoneC, otp: '123456', deviceId: 'dev-c-phase5' });
    userCToken = verifyC.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ==========================================
  // 1. STATUS & REPLY-TO-STATUS
  // ==========================================
  describe('1. Status Feed, Reactions & Reply-to-Status', () => {
    let statusId: string;

    it('creates a status and allows mutual chat participants to see it in feed', async () => {
      // User A and User B share a chat
      await Chat.create({
        type: 'direct',
        participants: [userAId, userBId],
        membersMeta: [
          { userId: userAId, role: 'member', unreadCount: 0 },
          { userId: userBId, role: 'member', unreadCount: 0 }
        ],
        createdBy: userAId
      });

      const res = await request(app)
        .post('/api/v1/status')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          content: 'Hello from Alice Status!',
          caption: 'My first update',
          privacy: 'contacts'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      statusId = res.body.data._id;

      // User B views feed
      const feedRes = await request(app)
        .get('/api/v1/status/feed')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.data.length).toBeGreaterThan(0);
    });

    it('records status view and allows reply-to-status creating a quoted direct message', async () => {
      // User B views status
      const viewRes = await request(app)
        .post(`/api/v1/status/${statusId}/view`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(viewRes.status).toBe(200);

      // User B replies to status
      const replyRes = await request(app)
        .post(`/api/v1/status/${statusId}/reply`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          content: 'Awesome status Alice!'
        });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body.data.message.content).toBe('Awesome status Alice!');
      expect(replyRes.body.data.message.replyTo).toBeDefined();
    });

    it('allows one reaction per user without duplicate reaction entries', async () => {
      // User B reacts with heart
      await request(app)
        .post(`/api/v1/status/${statusId}/react`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ emoji: '❤️' });

      // User B reacts again with thumbs up
      const reactRes = await request(app)
        .post(`/api/v1/status/${statusId}/react`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ emoji: '👍' });

      expect(reactRes.status).toBe(200);
      const userBReactions = reactRes.body.data.filter((r: any) => r.userId.toString() === userBId);
      expect(userBReactions.length).toBe(1);
      expect(userBReactions[0].emoji).toBe('👍');
    });
  });

  // ==========================================
  // 2. GROUPS: APPROVALS, PRIVACY, OWNERSHIP
  // ==========================================
  describe('2. Groups: approveNewMembers, allowGroupAdd, Ownership Transfer', () => {
    let groupId: string;
    let inviteCode: string;

    it('creates group with approveNewMembers enabled', async () => {
      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Engineers Club',
          description: 'Official group'
        });

      expect(res.status).toBe(201);
      groupId = res.body.data._id;
      inviteCode = res.body.data.inviteCode;

      // Enable approveNewMembers
      await request(app)
        .put(`/api/v1/groups/${groupId}/settings`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ approveNewMembers: true });
    });

    it('enforces allowGroupAdd privacy when adding members directly', async () => {
      // User B sets allowGroupAdd to nobody
      await User.findByIdAndUpdate(userBId, { 'privacySettings.allowGroupAdd': 'nobody' });

      const addRes = await request(app)
        .post(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ memberIds: [userBId] });

      expect(addRes.status).toBe(403);
      expect(addRes.body.message).toMatch(/privacy/i);

      // Restore privacy
      await User.findByIdAndUpdate(userBId, { 'privacySettings.allowGroupAdd': 'everyone' });
    });

    it('queues join request when approveNewMembers is true', async () => {
      const joinRes = await request(app)
        .post(`/api/v1/groups/join/${inviteCode}`)
        .set('Authorization', `Bearer ${userCToken}`);

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.data.status).toBe('pending_approval');

      // Admin views pending requests
      const pendingRes = await request(app)
        .get(`/api/v1/groups/${groupId}/pending-members`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.data.length).toBe(1);

      // Admin approves request
      const approveRes = await request(app)
        .post(`/api/v1/groups/${groupId}/approve-member/${userCId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(approveRes.status).toBe(200);

      const updatedGroup = await Chat.findById(groupId);
      expect(updatedGroup?.participants.some((p) => p.toString() === userCId)).toBe(true);
    });

    it('automatically transfers group ownership when the owner leaves', async () => {
      // Promote User C to admin
      await request(app)
        .post(`/api/v1/groups/${groupId}/members/${userCId}/promote`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Owner User A leaves group
      const leaveRes = await request(app)
        .delete(`/api/v1/groups/${groupId}/members/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(leaveRes.status).toBe(200);

      const groupAfterLeave = await Chat.findById(groupId);
      expect(groupAfterLeave?.createdBy.toString()).toBe(userCId);
      const userCMeta = groupAfterLeave?.membersMeta.find((m) => m.userId.toString() === userCId);
      expect(userCMeta?.role).toBe('owner');
    });
  });

  // ==========================================
  // 3. COMMUNITIES
  // ==========================================
  describe('3. Communities Management & Member Visibility', () => {
    let communityId: string;
    let testGroupId: string;

    it('creates community, computes dynamic membersCount, and allows group members to view it', async () => {
      // Create a test group with User B as participant
      const groupDoc = await Chat.create({
        type: 'group',
        name: 'Community Sub-group',
        participants: [userAId, userBId],
        membersMeta: [
          { userId: userAId, role: 'owner', unreadCount: 0 },
          { userId: userBId, role: 'member', unreadCount: 0 }
        ],
        createdBy: userAId
      });
      testGroupId = groupDoc._id.toString();

      const createRes = await request(app)
        .post('/api/v1/communities')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Tech Innovators',
          description: 'Developers community',
          initialGroupIds: [testGroupId]
        });

      expect(createRes.status).toBe(201);
      communityId = createRes.body.data._id;

      // User B (regular member of testGroup) views communities
      const commRes = await request(app)
        .get('/api/v1/communities')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(commRes.status).toBe(200);
      const found = commRes.body.data.find((c: any) => c._id.toString() === communityId);
      expect(found).toBeDefined();
      expect(found.membersCount).toBeGreaterThanOrEqual(2);
    });

    it('allows user to join community announcement chat and admin to remove groups', async () => {
      // User C joins community
      const joinRes = await request(app)
        .post(`/api/v1/communities/${communityId}/join`)
        .set('Authorization', `Bearer ${userCToken}`);

      expect(joinRes.status).toBe(200);

      // Admin removes group from community
      const removeGroupRes = await request(app)
        .delete(`/api/v1/communities/${communityId}/groups`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ groupIds: [testGroupId] });

      expect(removeGroupRes.status).toBe(200);

      const updatedComm = await Community.findById(communityId);
      expect(updatedComm?.groups.some((g) => g.toString() === testGroupId)).toBe(false);
    });
  });

  // ==========================================
  // 4. CHANNELS
  // ==========================================
  describe('4. Channels Posts, Reactions, Followers & Reports', () => {
    let channelId: string;
    let postId: string;

    it('creates channel, posts content, and allows followers to react', async () => {
      const chanRes = await request(app)
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Tech Updates',
          handle: 'techupdates_official',
          description: 'Daily tech broadcasts'
        });

      expect(chanRes.status).toBe(201);
      channelId = chanRes.body.data._id;

      // User B follows channel
      await request(app)
        .post(`/api/v1/channels/${channelId}/follow`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ follow: true });

      // Admin posts update
      const postRes = await request(app)
        .post(`/api/v1/channels/${channelId}/posts`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          content: 'Exciting news: v2.0 released!'
        });

      expect(postRes.status).toBe(201);
      postId = postRes.body.data._id;

      // User B reacts to post
      const reactRes = await request(app)
        .post(`/api/v1/channels/posts/${postId}/react`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ emoji: '🔥' });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data[0].emoji).toBe('🔥');
    });

    it('allows admin to edit post, view followers, and user to report channel', async () => {
      // Edit post
      const editRes = await request(app)
        .put(`/api/v1/channels/posts/${postId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ content: 'Updated content: v2.0 is live!' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.content).toBe('Updated content: v2.0 is live!');

      // Get followers
      const followersRes = await request(app)
        .get(`/api/v1/channels/${channelId}/followers`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(followersRes.status).toBe(200);
      expect(followersRes.body.data.length).toBeGreaterThan(0);

      // User C reports channel
      const reportRes = await request(app)
        .post(`/api/v1/channels/${channelId}/report`)
        .set('Authorization', `Bearer ${userCToken}`)
        .send({
          reason: 'Spam broadcast',
          details: 'Contains promotional links'
        });

      expect(reportRes.status).toBe(201);

      // Delete post
      const delRes = await request(app)
        .delete(`/api/v1/channels/posts/${postId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(delRes.status).toBe(200);
    });
  });

  // ==========================================
  // 5. CONTACTS & INVITE
  // ==========================================
  describe('5. Contacts Sync & Invite Flow', () => {
    it('syncs contacts with bulkWrite and normalizes numbers', async () => {
      const res = await request(app)
        .post('/api/v1/contacts/sync')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          phoneNumbers: [
            { name: 'Bob Friend', phoneNumber: '+919999111102' },
            { name: 'Unregistered Person', phoneNumber: '+919888877776' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const registered = res.body.data.find((c: any) => c.phoneNumber === '+919999111102');
      expect(registered?.isRegistered).toBe(true);

      const unregistered = res.body.data.find((c: any) => c.phoneNumber === '+919888877776');
      expect(unregistered?.isRegistered).toBe(false);
    });

    it('generates invite details for unregistered contacts via POST /contacts/invite', async () => {
      const res = await request(app)
        .post('/api/v1/contacts/invite')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ phoneNumber: '+919888877776' });

      expect(res.status).toBe(200);
      expect(res.body.data.inviteText).toContain('RSM Messenger');
      expect(res.body.data.phoneNumber).toBe('+919888877776');
    });
  });
});
