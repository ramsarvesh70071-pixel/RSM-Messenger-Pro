import { Message, Status } from '../models';

export const startBackgroundJobs = (): void => {
  // Run cleanup every 5 minutes
  setInterval(async () => {
    try {
      const now = new Date();

      // Clean up expired disappearing messages
      const deletedMessages = await Message.deleteMany({
        expiresAt: { $exists: true, $ne: null, $lt: now }
      });

      // Clean up expired status stories
      const deletedStatuses = await Status.deleteMany({
        expiresAt: { $lt: now }
      });

      if (deletedMessages.deletedCount > 0 || deletedStatuses.deletedCount > 0) {
        console.log(`[Cleanup Job] Cleaned up ${deletedMessages.deletedCount} expired messages and ${deletedStatuses.deletedCount} expired statuses.`);
      }
    } catch (err) {
      console.error('[Cleanup Job] Error running background cleanup:', err);
    }
  }, 5 * 60 * 1000);
};
