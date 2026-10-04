import { Router } from 'express';
import { GroupController } from '../controllers/group.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createGroupSchema, updateGroupSchema, addGroupMembersSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.post('/', validate(createGroupSchema), GroupController.createGroup);
router.put('/:id', validate(updateGroupSchema), GroupController.updateGroupInfo);
router.post('/:id/members', validate(addGroupMembersSchema), GroupController.addMembers);
router.delete('/:id/members/:memberId', GroupController.removeMember);
router.post('/:id/members/:memberId/promote', GroupController.promoteAdmin);
router.post('/:id/members/:memberId/demote', GroupController.demoteAdmin);
router.put('/:id/settings', GroupController.updateGroupSettings);
router.post('/:id/reset-invite', GroupController.resetInviteLink);
router.post('/join/:code', GroupController.joinByInviteCode);

// Phase 5: Pending member approvals
router.get('/:id/pending-members', GroupController.getPendingMembers);
router.post('/:id/approve-member/:userId', GroupController.approveMember);
router.post('/:id/reject-member/:userId', GroupController.rejectMember);

export default router;
