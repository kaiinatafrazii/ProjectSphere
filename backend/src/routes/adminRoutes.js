import express from 'express';
import {
  getAdminOverview,
  getAdminAnalytics,
  getAdminProfile,
  getAdminProjectDetails,
  getAdminUserDetails,
  changeUserAccountStatus,
  changeAdminPassword,
  listAdminContactMessages,
  listAdminProjects,
  listAdminReviews,
  listAdminUsers,
  listModerationHistory,
  markContactMessageRead,
  moderateProject,
  listProjectReports,
  resolveProjectReport,
} from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { downloadProjectSourceCode } from '../controllers/sourceCodeController.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/overview', getAdminOverview);
router.get('/analytics', getAdminAnalytics);
router.get('/projects', listAdminProjects);
router.get('/projects/:id', getAdminProjectDetails);
router.get('/projects/:id/source-code/download', downloadProjectSourceCode);
router.get('/reviews', listAdminReviews);
router.get('/reports', listProjectReports);
router.patch('/reports/:id', resolveProjectReport);
router.post('/projects/:id/moderate', moderateProject);
router.get('/history', listModerationHistory);
router.get('/users', listAdminUsers);
router.patch('/users/:id/status', changeUserAccountStatus);
router.get('/users/:id', getAdminUserDetails);
router.get('/contact-messages', listAdminContactMessages);
router.patch('/contact-messages/:id', markContactMessageRead);
router.get('/profile', getAdminProfile);
router.put('/password', changeAdminPassword);

export default router;
