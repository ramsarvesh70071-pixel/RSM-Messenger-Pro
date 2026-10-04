import { Router } from 'express';
import { StatusController } from '../controllers/status.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createStatusSchema, reactStatusSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.post('/', validate(createStatusSchema), StatusController.createStatus);
router.get('/feed', StatusController.getFeedStatuses);
router.get('/my', StatusController.getMyStatuses);
router.post('/:id/view', StatusController.viewStatus);
router.post('/:id/reply', StatusController.replyToStatus);
router.post('/:id/react', validate(reactStatusSchema), StatusController.reactToStatus);
router.delete('/:id', StatusController.deleteStatus);

export default router;
