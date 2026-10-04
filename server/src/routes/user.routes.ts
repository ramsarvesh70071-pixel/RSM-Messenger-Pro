import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload, validateUploadedFile } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema, updatePrivacySchema, blockUserSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.get('/profile', UserController.getProfile);
router.get('/', UserController.searchUsers);
router.put('/profile', validate(updateProfileSchema), UserController.updateProfile);
router.post('/avatar', upload.single('avatar'), validateUploadedFile, UserController.uploadAvatar);

router.get('/privacy', UserController.getPrivacySettings);
router.put('/privacy', validate(updatePrivacySchema), UserController.updatePrivacySettings);

router.get('/blocked', UserController.getBlockedUsers);
router.post('/block', validate(blockUserSchema), UserController.blockUser);
router.delete('/block/:targetUserId', UserController.unblockUser);

router.get('/:id', UserController.getUserById);

export default router;
