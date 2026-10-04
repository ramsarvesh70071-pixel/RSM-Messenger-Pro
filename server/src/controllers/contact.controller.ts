import { Response } from 'express';
import { User, Contact } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { normalizePhoneNumber } from '../utils/phone';
import { escapeRegex } from '../utils/regex';

export class ContactController {
  // 1. Sync device contacts with registered users using bulk operations
  static async syncContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { phoneNumbers } = req.body; // Array of { name: string, phoneNumber: string }
      if (!Array.isArray(phoneNumbers)) {
        sendError(res, 'phoneNumbers must be an array', 400);
        return;
      }

      // Cap at 1000 contacts per sync batch
      const batch = phoneNumbers.slice(0, 1000);

      const normalizedList = batch
        .map((p) => ({
          name: (p.name || '').trim(),
          phoneNumber: normalizePhoneNumber(p.phoneNumber || '')
        }))
        .filter((p) => Boolean(p.phoneNumber));

      const cleanNumbers = normalizedList.map((p) => p.phoneNumber);

      const registeredUsers = await User.find({
        phoneNumber: { $in: cleanNumbers }
      }).select('_id name phoneNumber avatarUrl about');

      const phoneToUserMap = new Map();
      registeredUsers.forEach((u) => {
        phoneToUserMap.set(u.phoneNumber, u);
      });

      const bulkOps = normalizedList.map((item) => {
        const matchedUser = phoneToUserMap.get(item.phoneNumber);
        return {
          updateOne: {
            filter: { userId: req.user._id, phoneNumber: item.phoneNumber },
            update: {
              $set: {
                name: item.name || matchedUser?.name || item.phoneNumber,
                phoneNumber: item.phoneNumber,
                isRegistered: Boolean(matchedUser),
                contactUserId: matchedUser?._id,
                avatarUrl: matchedUser?.avatarUrl || '',
                about: matchedUser?.about || ''
              }
            },
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        await Contact.bulkWrite(bulkOps as any);
      }

      const allSynced = await Contact.find({
        userId: req.user._id,
        phoneNumber: { $in: cleanNumbers }
      });

      sendSuccess(res, allSynced, 'Contacts synced successfully');
    } catch (error) {
      sendError(res, 'Failed to sync contacts', 500, error instanceof Error ? error.message : 'Unknown');
    }
  }

  // 2. Get list of contacts
  static async getContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, registeredOnly } = req.query;
      const query: any = { userId: req.user._id };

      if (registeredOnly === 'true') {
        query.isRegistered = true;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const safe = escapeRegex(search.trim());
        query.$or = [
          { name: { $regex: safe, $options: 'i' } },
          { phoneNumber: { $regex: safe, $options: 'i' } }
        ];
      }

      const contacts = await Contact.find(query)
        .sort({ name: 1 })
        .populate('contactUserId', 'name phoneNumber avatarUrl about isOnline lastSeen');

      sendSuccess(res, contacts, 'Contacts retrieved successfully');
    } catch (error) {
      sendError(res, 'Failed to fetch contacts', 500);
    }
  }

  // 3. Add single contact
  static async addContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, phoneNumber } = req.body;
      if (!name || !phoneNumber) {
        sendError(res, 'Name and phone number are required', 400);
        return;
      }

      const cleanPhone = normalizePhoneNumber(phoneNumber);
      const matchedUser = await User.findOne({ phoneNumber: cleanPhone });

      const contact = await Contact.findOneAndUpdate(
        { userId: req.user._id, phoneNumber: cleanPhone },
        {
          userId: req.user._id,
          name: name.trim(),
          phoneNumber: cleanPhone,
          isRegistered: Boolean(matchedUser),
          contactUserId: matchedUser?._id,
          avatarUrl: matchedUser?.avatarUrl || '',
          about: matchedUser?.about || ''
        },
        { upsert: true, new: true }
      );

      sendSuccess(res, contact, 'Contact added successfully');
    } catch (error) {
      sendError(res, 'Failed to add contact', 500);
    }
  }

  // 4. Invite unregistered contact to app
  static async inviteContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        sendError(res, 'Phone number is required', 400);
        return;
      }

      const cleanPhone = normalizePhoneNumber(phoneNumber);
      const inviteText = `Hey! I'm using RSM Messenger Pro. Download and join me to chat: https://rsm-messenger-pro.onrender.com`;
      sendSuccess(res, { phoneNumber: cleanPhone, inviteText }, 'Invite details generated');
    } catch (error) {
      sendError(res, 'Failed to generate invite', 500);
    }
  }
}
