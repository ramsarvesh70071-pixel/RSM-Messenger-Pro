import { Chat, IChatDocument } from '../models/Chat.model';
import { Message, IMessageDocument } from '../models/Message.model';
import { Call, ICallDocument } from '../models/Call.model';
import { Status, IStatusDocument } from '../models/Status.model';
import { BlockedUser } from '../models/BlockedUser.model';

export class ForbiddenError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = statusCode;
  }
}

/**
 * Asserts that a user is an active participant in the specified chat.
 */
export async function assertChatMember(chatId: string, userId: string): Promise<IChatDocument> {
  const chat = await Chat.findOne({
    _id: chatId,
    participants: userId
  });

  if (!chat) {
    throw new ForbiddenError('Access denied: You are not a participant in this chat', 403);
  }
  return chat;
}

/**
 * Asserts that a user has valid access to a specific message by checking their chat membership.
 */
export async function assertMessageAccess(
  messageId: string,
  userId: string
): Promise<{ message: IMessageDocument; chat: IChatDocument }> {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new ForbiddenError('Message not found', 404);
  }

  const chat = await assertChatMember(message.chatId.toString(), userId);
  return { message, chat };
}

/**
 * Asserts that a user is an admin of the specified group chat.
 */
export async function assertGroupAdmin(chatId: string, userId: string): Promise<IChatDocument> {
  const chat = await assertChatMember(chatId, userId);
  if (chat.type !== 'group') {
    throw new ForbiddenError('This operation is only valid for group chats', 400);
  }

  const userMeta = chat.membersMeta.find((m) => m.userId.toString() === userId.toString());
  const isAdmin = userMeta && (userMeta.role === 'admin' || userMeta.role === 'owner');
  const isCreator = chat.createdBy && chat.createdBy.toString() === userId.toString();

  if (!isAdmin && !isCreator) {
    throw new ForbiddenError('Access denied: Group admin privileges required', 403);
  }
  return chat;
}

/**
 * Asserts that a user is either the caller or receiver in a call session.
 */
export async function assertCallParticipant(callId: string, userId: string): Promise<ICallDocument> {
  const call = await Call.findById(callId);
  if (!call) {
    throw new ForbiddenError('Call not found', 404);
  }

  const isParticipant =
    call.caller.toString() === userId.toString() ||
    call.receiver.toString() === userId.toString() ||
    call.participants?.some((p) => p.userId.toString() === userId.toString());

  if (!isParticipant) {
    throw new ForbiddenError('Access denied: Not a participant in this call', 403);
  }
  return call;
}

/**
 * Asserts that a viewer has permission to view a status update.
 */
export async function assertStatusAccess(statusId: string, viewerId: string): Promise<IStatusDocument> {
  const status = await Status.findById(statusId);
  if (!status) {
    throw new ForbiddenError('Status update not found or expired', 404);
  }

  const creatorId = status.userId.toString();
  // Self is always allowed
  if (creatorId === viewerId) {
    return status;
  }

  // Check if blocked in either direction
  const isBlocked = await BlockedUser.findOne({
    $or: [
      { userId: creatorId, blockedUserId: viewerId },
      { userId: viewerId, blockedUserId: creatorId }
    ]
  });

  if (isBlocked) {
    throw new ForbiddenError('Access denied: User is blocked', 403);
  }

  return status;
}
