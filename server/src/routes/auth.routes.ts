import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import { validate } from '../middleware/validate.middleware';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema } from '../schemas';

const router = Router();

router.post('/request-otp', authRateLimiter, validate(requestOtpSchema), AuthController.requestOtp);
router.post('/verify-otp', authRateLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/refresh-token', validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.delete('/delete-account', authenticate, AuthController.deleteAccount);

export default router;
