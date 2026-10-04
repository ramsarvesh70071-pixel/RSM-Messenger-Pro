import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  sendMessageSchema,
  editMessageSchema,
  reactMessageSchema,
  forwardMessagesSchema
} from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/search', MessageController.searchMessages);
router.get('/chat/:chatId', MessageController.getMessages);
router.post('/', validate(sendMessageSchema), MessageController.sendMessage);
router.put('/:id', validate(editMessageSchema), MessageController.editMessage);
router.delete('/:id/me', MessageController.deleteForMe);
router.delete('/:id/everyone', MessageController.deleteForEveryone);
router.post('/:id/react', validate(reactMessageSchema), MessageController.reactToMessage);
router.post('/:id/star', MessageController.toggleStarMessage);
router.get('/starred', MessageController.getStarredMessages);
router.post('/:id/pin', MessageController.togglePinMessage);
router.post('/forward', validate(forwardMessagesSchema), MessageController.forwardMessages);
router.post('/read', MessageController.markAsRead);
router.post('/delivered', MessageController.markDelivered);
router.get('/chat/:chatId/context/:messageId', MessageController.getMessageContext);

export default router;
