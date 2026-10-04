import { Router } from 'express';
import { ChannelController } from '../controllers/channel.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', ChannelController.createChannel);
router.get('/', ChannelController.getChannels);
router.post('/:id/follow', ChannelController.toggleFollow);
router.post('/:id/posts', ChannelController.createPost);
router.get('/:id/posts', ChannelController.getPosts);

// Phase 5: Posts CRUD, reactions, followers & report
router.put('/posts/:postId', ChannelController.editPost);
router.delete('/posts/:postId', ChannelController.deletePost);
router.post('/posts/:postId/react', ChannelController.reactToPost);
router.get('/:id/followers', ChannelController.getFollowers);
router.post('/:id/report', ChannelController.reportChannel);

export default router;
