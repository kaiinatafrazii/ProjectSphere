import express from 'express';
import {
  getAdminOverview,
  listAdminProjects,
  listAdminUsers,
  listModerationHistory,
  moderateProject,
} from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/overview', getAdminOverview);
router.get('/projects', listAdminProjects);
router.post('/projects/:id/moderate', moderateProject);
router.get('/history', listModerationHistory);
router.get('/users', listAdminUsers);

export default router;
