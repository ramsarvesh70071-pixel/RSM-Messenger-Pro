import { z } from 'zod';
import { objectIdSchema } from '../middleware/validate.middleware';

// -------------------------------------------------------------
// AUTH SCHEMAS
// -------------------------------------------------------------
export const requestOtpSchema = z.object({
  phoneNumber: z.string().min(5).max(30),
  countryCode: z.string().max(5).optional()
}).strict();

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(5).max(30),
  countryCode: z.string().max(5).optional(),
  otp: z.string().min(4).max(8),
  deviceId: z.string().max(120).optional(),
  deviceName: z.string().max(100).optional(),
  deviceType: z.enum(['android', 'ios', 'web', 'desktop']).optional(),
  pushToken: z.string().max(300).optional()
}).strict();

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().max(120).optional()
}).strict();

// -------------------------------------------------------------
// CHAT & GROUP SCHEMAS
// -------------------------------------------------------------
export const createDirectChatSchema = z.object({
  recipientId: objectIdSchema.optional(),
  targetUserId: objectIdSchema.optional()
}).refine((data) => data.recipientId || data.targetUserId, {
  message: 'Either recipientId or targetUserId must be provided'
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  iconUrl: z.string().optional(),
  memberIds: z.array(objectIdSchema).max(1024).optional(),
  participantIds: z.array(objectIdSchema).max(1024).optional()
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  iconUrl: z.string().optional(),
  onlyAdminsCanSend: z.boolean().optional(),
  onlyAdminsCanEditInfo: z.boolean().optional(),
  approveNewMembers: z.boolean().optional()
}).strict();

export const groupMemberActionSchema = z.object({
  userId: objectIdSchema
}).strict();

export const addGroupMembersSchema = z.object({
  memberIds: z.array(objectIdSchema).min(1).max(1024).optional(),
  participantIds: z.array(objectIdSchema).min(1).max(1024).optional()
}).refine((data) => (data.memberIds && data.memberIds.length > 0) || (data.participantIds && data.participantIds.length > 0), {
  message: 'Must provide at least one memberId to add'
});

export const disappearingMessagesSchema = z.object({
  enabled: z.boolean().optional(),
  durationSeconds: z.number().int().min(0).max(7776000).optional() // max 90 days
});

// -------------------------------------------------------------
// MESSAGE SCHEMAS
// -------------------------------------------------------------
const attachmentInputSchema = z.object({
  url: z.string().min(1),
  // Accept both the web/mobile client naming (fileName/fileSize) and the legacy API naming (filename/sizeBytes)
  type: z.enum(['image', 'audio', 'video', 'document', 'voice']).optional(),
  fileName: z.string().max(255).optional(),
  filename: z.string().max(255).optional(),
  fileSize: z.number().min(0).optional(),
  sizeBytes: z.number().min(0).optional(),
  mimeType: z.string().max(100).optional(),
  thumbnailUrl: z.string().optional(),
  duration: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  waveform: z.array(z.number()).max(256).optional()
});

export const sendMessageSchema = z.object({
  chatId: objectIdSchema,
  content: z.string().max(4096).optional().default(''),
  type: z
    .enum(['text', 'emoji', 'image', 'audio', 'voice', 'video', 'document', 'location', 'contact'])
    .default('text'),
  replyToId: objectIdSchema.optional(),
  // Clients may send a reply preview object; the server rebuilds it from the original message (never trusted)
  replyTo: z.object({ messageId: objectIdSchema }).passthrough().optional(),
  mentions: z.array(z.string().max(64)).max(50).optional(),
  mediaUrl: z.string().optional(),
  clientMsgId: z.string().max(100).optional(),
  attachments: z.array(attachmentInputSchema).max(10).optional(),
  contact: z
    .object({
      name: z.string().max(255),
      phoneNumber: z.string().max(40),
      avatarUrl: z.string().optional(),
      vCardData: z.string().max(5000).optional()
    })
    .optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().max(255).optional(),
      address: z.string().max(500).optional()
    })
    .optional()
});

export const forwardMessagesSchema = z.object({
  messageIds: z.array(objectIdSchema).min(1).max(50),
  targetChatIds: z.array(objectIdSchema).min(1).max(5)
}).strict();

export const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(4096)
}).strict();

export const reactMessageSchema = z.object({
  emoji: z.string().trim().min(1).max(10)
}).strict();

// -------------------------------------------------------------
// STATUS / STORY SCHEMAS
// -------------------------------------------------------------
export const createStatusSchema = z.object({
  type: z.enum(['text', 'image', 'video']).default('text'),
  text: z.string().max(1000).optional(),
  content: z.string().max(1000).optional(),
  caption: z.string().max(1000).optional(),
  backgroundColor: z.string().max(30).optional(),
  mediaUrl: z.string().optional()
});

export const reactStatusSchema = z.object({
  emoji: z.string().trim().min(1).max(10)
}).strict();

// -------------------------------------------------------------
// CALL SCHEMAS
// -------------------------------------------------------------
export const logCallSchema = z.object({
  receiverId: objectIdSchema,
  callType: z.enum(['voice', 'video']),
  status: z.enum(['initiated', 'ringing', 'connected', 'ended', 'declined', 'rejected', 'missed', 'completed', 'busy', 'failed']).default('initiated'),
  duration: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  chatId: objectIdSchema.optional()
});

export const updateCallSchema = z.object({
  status: z.enum(['initiated', 'ringing', 'connected', 'ended', 'declined', 'rejected', 'missed', 'completed', 'busy', 'failed']),
  duration: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional()
});

// -------------------------------------------------------------
// USER & PRIVACY SCHEMAS
// -------------------------------------------------------------
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  about: z.string().max(300).optional(),
  avatarUrl: z.string().optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric').optional()
}).strict();

export const updatePrivacySchema = z.object({
  lastSeen: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  profilePhoto: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  about: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  status: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  readReceipts: z.boolean().optional(),
  online: z.enum(['everyone', 'contacts', 'nobody', 'same_as_last_seen']).optional(),
  allowCalls: z.enum(['everyone', 'contacts', 'nobody']).optional(),
  allowGroupAdd: z.enum(['everyone', 'contacts', 'nobody']).optional()
});

export const blockUserSchema = z.object({
  targetUserId: objectIdSchema
}).strict();

export const reportUserSchema = z.object({
  targetUserId: objectIdSchema,
  reason: z.string().trim().min(1).max(500),
  messageId: objectIdSchema.optional()
}).strict();

// -------------------------------------------------------------
// CONTACT SCHEMAS
// -------------------------------------------------------------
export const syncContactsSchema = z.object({
  phoneNumbers: z.array(
    z.union([
      z.string().min(3).max(35),
      z.object({
        name: z.string().max(100).optional(),
        phoneNumber: z.string().min(3).max(35)
      })
    ])
  ).max(5000)
});

// -------------------------------------------------------------
// ADMIN SCHEMAS
// -------------------------------------------------------------
export const suspendUserSchema = z.object({
  isSuspended: z.boolean().optional(),
  suspend: z.boolean().optional(),
  reason: z.string().max(500).optional(),
  durationDays: z.number().int().min(1).max(3650).optional()
}).refine((data) => data.isSuspended !== undefined || data.suspend !== undefined, {
  message: 'isSuspended or suspend boolean is required'
});

export const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  action: z.enum(['none', 'warn', 'suspend_user', 'delete_message']).default('none'),
  adminNotes: z.string().max(500).optional()
}).strict();

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  target: z.enum(['all', 'android', 'ios', 'web']).default('all')
}).strict();
