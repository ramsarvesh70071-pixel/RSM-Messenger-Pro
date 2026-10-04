import { Router } from 'express';
import { MediaController } from '../controllers/media.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload, validateUploadedFile } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), validateUploadedFile, MediaController.uploadMedia);

export default router;
