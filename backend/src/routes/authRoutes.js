import express from 'express';
import { login, logout, register, restoreSession } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', restoreSession);
router.post('/logout', logout);

export default router;
