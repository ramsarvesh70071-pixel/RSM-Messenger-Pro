import { Router } from 'express';
import { CommunityController } from '../controllers/community.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', CommunityController.createCommunity);
router.get('/', CommunityController.getCommunities);
router.post('/:id/join', CommunityController.joinCommunity);
router.post('/:id/groups', CommunityController.addGroups);
router.delete('/:id/groups', CommunityController.removeGroups);

export default router;
