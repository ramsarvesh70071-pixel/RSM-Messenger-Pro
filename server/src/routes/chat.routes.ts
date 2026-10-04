import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createDirectChatSchema, disappearingMessagesSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/', ChatController.getChats);
router.post('/direct', validate(createDirectChatSchema), ChatController.getOrCreateDirectChat);
router.get('/:id', ChatController.getChatById);
router.post('/:id/pin', ChatController.togglePinChat);
router.post('/:id/archive', ChatController.toggleArchiveChat);
router.post('/:id/mute', ChatController.toggleMuteChat);
router.post('/:id/clear', ChatController.clearChat);
router.post('/:id/disappearing', validate(disappearingMessagesSchema), ChatController.setDisappearingMessages);
router.post('/:id/wallpaper', ChatController.updateWallpaper);

export default router;
