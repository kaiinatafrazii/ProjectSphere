import express from 'express';
import {
  getAdminOverview,
  getAdminProfile,
  getAdminUserDetails,
  changeAdminPassword,
  listAdminContactMessages,
  listAdminProjects,
  listAdminReviews,
  listAdminUsers,
  listModerationHistory,
  markContactMessageRead,
  moderateProject,
} from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/overview', getAdminOverview);
router.get('/projects', listAdminProjects);
router.get('/reviews', listAdminReviews);
router.post('/projects/:id/moderate', moderateProject);
router.get('/history', listModerationHistory);
router.get('/users', listAdminUsers);
router.get('/users/:id', getAdminUserDetails);
router.get('/contact-messages', listAdminContactMessages);
router.patch('/contact-messages/:id', markContactMessageRead);
router.get('/profile', getAdminProfile);
router.put('/password', changeAdminPassword);

export default router;
