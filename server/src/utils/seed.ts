import mongoose from 'mongoose';
import { env } from '../config/environment';
import { User, Chat, Message, Status, Channel, ChannelPost, Community } from '../models';

const seed = async () => {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('[Seed] Connected! Clearing existing demo collections...');

    await Promise.all([
      User.deleteMany({}),
      Chat.deleteMany({}),
      Message.deleteMany({}),
      Status.deleteMany({}),
      Channel.deleteMany({}),
      ChannelPost.deleteMany({}),
      Community.deleteMany({})
    ]);

    console.log('[Seed] Creating demo users...');
    const users = await User.create([
      {
        phoneNumber: '+919876543210',
        countryCode: '+91',
        name: 'Ramsarvesh Maurya',
        username: 'ramsarvesh',
        about: 'Building high-scale real-time distributed systems 🚀',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        isOnline: true,
        role: 'admin',
        privacySettings: {
          lastSeen: 'everyone',
          online: 'everyone',
          profilePhoto: 'everyone',
          about: 'everyone',
          status: 'everyone',
          readReceipts: true,
          allowGroupAdd: 'everyone',
          allowCalls: 'everyone'
        }
      },
      {
        phoneNumber: '+919876543211',
        countryCode: '+91',
        name: 'Aarav Sharma',
        username: 'aarav_dev',
        about: 'React Native & Mobile UI Specialist ✨',
        avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
        isOnline: true,
        role: 'user',
        privacySettings: {
          lastSeen: 'everyone',
          online: 'everyone',
          profilePhoto: 'everyone',
          about: 'everyone',
          status: 'everyone',
          readReceipts: true,
          allowGroupAdd: 'everyone',
          allowCalls: 'everyone'
        }
      },
      {
        phoneNumber: '+919876543212',
        countryCode: '+91',
        name: 'Priya Patel',
        username: 'priya_design',
        about: 'Designing modern dark-mode glassmorphic experiences 🎨',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        isOnline: false,
        lastSeen: new Date(Date.now() - 15 * 60 * 1000),
        role: 'user'
      },
      {
        phoneNumber: '+919876543213',
        countryCode: '+91',
        name: 'Rohan Verma',
        username: 'rohan_pm',
        about: 'Product Manager @ RSM | Coffee & Roadmaps ☕',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        isOnline: false,
        lastSeen: new Date(Date.now() - 3600 * 1000),
        role: 'user'
      }
    ]);

    const [ram, aarav, priya, rohan] = users;
    console.log(`[Seed] Created ${users.length} demo users!`);

    console.log('[Seed] Creating demo direct chats...');
    // Direct Chat: Ram & Aarav
    const directChat1 = await Chat.create({
      type: 'direct',
      participants: [ram._id, aarav._id],
      membersMeta: [
        { userId: ram._id, role: 'member', unreadCount: 0, isPinned: true },
        { userId: aarav._id, role: 'member', unreadCount: 0 }
      ],
      createdBy: ram._id
    });

    // Messages for directChat1
    const msg1 = await Message.create({
      chatId: directChat1._id,
      senderId: ram._id,
      type: 'text',
      content: 'Hey Aarav! Have you tested the WebRTC video calling pipeline?',
      status: 'read',
      readBy: [{ userId: aarav._id, readAt: new Date() }]
    });

    const msg2 = await Message.create({
      chatId: directChat1._id,
      senderId: aarav._id,
      type: 'text',
      content: 'Yes Ram! The Socket.IO signaling with STUN is working smoothly with sub-second latency ⚡',
      status: 'read',
      replyTo: {
        messageId: msg1._id,
        senderId: ram._id,
        senderName: ram.name,
        type: 'text',
        content: msg1.content
      },
      reactions: [{ userId: ram._id, emoji: '🔥', createdAt: new Date() }],
      readBy: [{ userId: ram._id, readAt: new Date() }]
    });

    const msg3 = await Message.create({
      chatId: directChat1._id,
      senderId: ram._id,
      type: 'voice',
      content: 'Voice note preview',
      attachments: [
        {
          url: '/uploads/audio/sample_voice.mp3',
          mimeType: 'audio/mpeg',
          fileName: 'Voice note (0:12)',
          fileSize: 125000,
          duration: 12,
          waveform: [15, 35, 60, 85, 95, 80, 50, 65, 90, 75, 45, 20]
        }
      ],
      status: 'sent',
      reactions: [{ userId: aarav._id, emoji: '❤️', createdAt: new Date() }]
    });

    directChat1.lastMessage = msg3._id as any;
    directChat1.lastMessageAt = msg3.createdAt;
    await directChat1.save();

    console.log('[Seed] Creating demo Group: RSM Engineering Core...');
    const groupChat = await Chat.create({
      type: 'group',
      name: 'RSM Engineering Core',
      description: 'Official WhatsApp-style engineering group for RSM Messenger developers.',
      avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
      participants: [ram._id, aarav._id, priya._id, rohan._id],
      membersMeta: [
        { userId: ram._id, role: 'owner', unreadCount: 0, isPinned: true },
        { userId: aarav._id, role: 'admin', unreadCount: 0 },
        { userId: priya._id, role: 'member', unreadCount: 0 },
        { userId: rohan._id, role: 'member', unreadCount: 0 }
      ],
      createdBy: ram._id,
      groupSettings: {
        onlyAdminsCanSend: false,
        onlyAdminsCanEditInfo: true,
        approveNewMembers: false,
        announcementOnly: false
      }
    });

    const groupMsg1 = await Message.create({
      chatId: groupChat._id,
      senderId: ram._id,
      type: 'system',
      content: 'Ramsarvesh Maurya created group "RSM Engineering Core"',
      status: 'read'
    });

    const groupMsg2 = await Message.create({
      chatId: groupChat._id,
      senderId: priya._id,
      type: 'text',
      content: 'Welcome team! The mobile UI with WhatsApp green accents and dark mode is ready for testing! 🚀',
      status: 'read',
      reactions: [
        { userId: ram._id, emoji: '👍', createdAt: new Date() },
        { userId: aarav._id, emoji: '❤️', createdAt: new Date() }
      ]
    });

    groupChat.lastMessage = groupMsg2._id as any;
    groupChat.lastMessageAt = groupMsg2.createdAt;
    await groupChat.save();

    console.log('[Seed] Creating demo Status stories...');
    await Status.create([
      {
        userId: ram._id,
        type: 'text',
        content: 'Launching RSM Messenger v1.0 Production Release! 🚀🔥',
        backgroundColor: '#075E54',
        fontFamily: 'System',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
      },
      {
        userId: aarav._id,
        type: 'image',
        content: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
        caption: 'Coding through the night with TypeScript & React Native 💻',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
      }
    ]);

    console.log('[Seed] Creating demo Broadcast Channel...');
    const channel = await Channel.create({
      name: 'RSM Product Updates',
      handle: 'rsm_updates',
      description: 'Official announcements and feature releases for RSM Messenger.',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      creatorId: ram._id,
      admins: [ram._id],
      followers: [ram._id, aarav._id, priya._id, rohan._id],
      followersCount: 4,
      isVerified: true
    });

    await ChannelPost.create({
      channelId: channel._id,
      authorId: ram._id,
      content: 'Welcome to the official RSM Updates channel! Real-time messaging, WebRTC calling, and full privacy controls are now live. 🎉',
      viewsCount: 42
    });

    console.log('\n========================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('Demo Users for Login (Mock OTP: 123456):');
    console.log('1. Ramsarvesh Maurya (Admin): +919876543210');
    console.log('2. Aarav Sharma:              +919876543211');
    console.log('3. Priya Patel:               +919876543212');
    console.log('4. Rohan Verma:               +919876543213');
    console.log('========================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
