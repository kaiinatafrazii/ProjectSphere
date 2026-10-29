import express from 'express';
import { currentUser, login, logout, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, currentUser);
router.post('/logout', logout);

export default router;
