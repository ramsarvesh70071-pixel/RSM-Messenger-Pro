import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { suspendUserSchema, resolveReportSchema } from '../schemas';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', AdminController.getDashboardStats);
router.get('/users', AdminController.getUsers);
router.get('/users/:id/details', AdminController.getUserDetails);
router.post('/users/:id/suspend', validate(suspendUserSchema), AdminController.toggleSuspendUser);
router.delete('/users/:id', AdminController.deleteUser);
router.post('/broadcast', AdminController.broadcastAnnouncement);
router.get('/reports', AdminController.getReports);
router.post('/reports/:id/resolve', validate(resolveReportSchema), AdminController.resolveReport);
router.get('/audit-logs', AdminController.getAuditLogs);
router.get('/health', AdminController.getSystemHealth);

export default router;
