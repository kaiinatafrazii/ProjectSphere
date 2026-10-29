import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { addReviewHandler, getProjectByIdHandler, getProjectsHandler, publishProjectHandler } from '../controllers/projectController.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteMyProject, getMyDashboard, getMyProjects, updateMyProject } from '../controllers/dashboardController.js';
import { removeSavedProject, saveProject } from '../controllers/bookmarkController.js';
import {
  getOwnSourceCodeMetadata,
  requireProjectSourceOwner,
  sourceCodeUploadLimiter,
  sourceCodeUploadMiddleware,
  uploadProjectSourceCode,
} from '../controllers/sourceCodeController.js';

const router = express.Router();
const projectSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many project submissions. Please try again later.' },
});

router.get('/', getProjectsHandler);
router.get('/mine', requireAuth, getMyProjects);
router.get('/dashboard', requireAuth, getMyDashboard);
router.get('/:id/source-code', requireAuth, getOwnSourceCodeMetadata);
router.post(
  '/:id/source-code',
  requireAuth,
  sourceCodeUploadLimiter,
  requireProjectSourceOwner,
  sourceCodeUploadMiddleware,
  uploadProjectSourceCode
);
router.put('/:id', requireAuth, projectSubmissionLimiter, updateMyProject);
router.delete('/:id', requireAuth, deleteMyProject);
router.post('/:id/bookmark', requireAuth, saveProject);
router.delete('/:id/bookmark', requireAuth, removeSavedProject);
router.get('/:id', getProjectByIdHandler);
router.post('/', requireAuth, projectSubmissionLimiter, publishProjectHandler);
router.post('/:id/reviews', requireAuth, rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many reviews submitted. Please try again later.' },
}), addReviewHandler);

export default router;
