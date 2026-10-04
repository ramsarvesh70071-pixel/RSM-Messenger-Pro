import { Router } from 'express';
import { CallController } from '../controllers/call.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { logCallSchema, updateCallSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/ice-servers', CallController.getIceServers);
router.post('/log', validate(logCallSchema), CallController.createCallLog);
router.put('/log/:id', validate(updateCallSchema), CallController.updateCallStatus);
router.get('/history', CallController.getCallHistory);
router.delete('/log/:id', CallController.deleteCallLog);

export default router;
