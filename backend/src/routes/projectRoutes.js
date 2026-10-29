import express from 'express';
import { addReviewHandler, getProjectByIdHandler, getProjectsHandler, publishProjectHandler } from '../controllers/projectController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getProjectsHandler);
router.get('/:id', getProjectByIdHandler);
router.post('/', requireAuth, publishProjectHandler);
router.post('/:id/reviews', requireAuth, addReviewHandler);

export default router;
