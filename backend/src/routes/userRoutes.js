import express from 'express';
import { getUserProfile } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', requireAuth, (req, res) => getUserProfile({ params: { id: req.user.id }, user: req.user }, res));
router.get('/:id', getUserProfile);

export default router;
