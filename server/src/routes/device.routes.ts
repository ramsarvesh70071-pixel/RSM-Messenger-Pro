import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', DeviceController.getDevices);
router.delete('/:deviceId', DeviceController.logoutDevice);
router.put('/push-token', DeviceController.updatePushToken);

export default router;
