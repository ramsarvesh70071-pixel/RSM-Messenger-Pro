import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { syncContactsSchema } from '../schemas';

const router = Router();

router.use(authenticate);

router.post('/sync', validate(syncContactsSchema), ContactController.syncContacts);
router.get('/', ContactController.getContacts);
router.post('/', ContactController.addContact);
router.post('/invite', ContactController.inviteContact);

export default router;
