import { addReviewService, getProjectByIdService, getProjects, publishProjectService } from '../services/projectService.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { validateProjectInput } from '../utils/projectValidation.js';

export async function getProjectsHandler(req, res) {
  try {
    const projects = await getProjects({
      category: req.query.category,
      search: req.query.search,
    });
    return sendSuccess(res, { projects });
  } catch (error) {
    console.error('Project listing failed:', error);
    return sendError(res, 500, 'Unable to fetch projects right now.');
  }
}

export async function getProjectByIdHandler(req, res) {
  try {
    const project = await getProjectByIdService(req.params.id);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }
    return sendSuccess(res, { project });
  } catch (error) {
    console.error('Project retrieval failed:', error);
    return sendError(res, 500, 'Unable to fetch this project right now.');
  }
}

export async function publishProjectHandler(req, res) {
  try {
    const validated = validateProjectInput(req.body);
    if (validated.error) return sendError(res, 400, validated.error);

    const result = await publishProjectService({
      userId: req.user.id,
      ...validated.data,
    });

    return sendSuccess(res, { projectId: result.id, message: 'Your project was submitted for review.' }, 201);
  } catch (error) {
    console.error('Project publishing failed:', error);
    return sendError(res, 500, 'Unable to publish project right now.');
  }
}

export async function addReviewHandler(req, res) {
  try {
    const { rating, comment } = req.body;
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5 || typeof comment !== 'string' || !comment.trim() || comment.length > 3000) {
      return sendError(res, 400, 'A rating and comment are required.');
    }

    const result = await addReviewService({
      projectId: req.params.id,
      userId: req.user.id,
      rating: Number(rating),
      comment,
    });

    return sendSuccess(res, { ...result }, 201);
  } catch (error) {
    if (error.statusCode) return sendError(res, error.statusCode, error.message);
    console.error('Review submission failed:', error);
    return sendError(res, 500, 'Unable to submit review right now.');
  }
}
