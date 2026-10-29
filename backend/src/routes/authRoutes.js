import express from 'express';
import { login, logout, register, restoreSession } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', restoreSession);
router.post('/logout', logout);

export default router;
