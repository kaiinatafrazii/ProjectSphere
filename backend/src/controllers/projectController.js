import { addReviewService, getProjectByIdService, getProjects, publishProjectService } from '../services/projectService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function getProjectsHandler(req, res) {
  try {
    const projects = await getProjects({
      category: req.query.category,
      search: req.query.search,
    });
    return sendSuccess(res, { projects });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to fetch projects.');
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
    return sendError(res, 500, error.message || 'Unable to fetch project.');
  }
}

export async function publishProjectHandler(req, res) {
  try {
    const { title, tagline, category, techStack, summary, overview, repoUrl, liveUrl, screenshotUrl } = req.body;
    if (!title || !tagline || !category || !summary || !overview) {
      return sendError(res, 400, 'Please complete the required project details.');
    }

    const result = await publishProjectService({
      userId: req.user.id,
      title,
      tagline,
      category,
      techStack: techStack || [],
      summary,
      overview,
      repoUrl,
      liveUrl,
      screenshotUrl,
    });

    return sendSuccess(res, { projectId: result.id, message: 'Project published successfully.' }, 201);
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to publish project.');
  }
}

export async function addReviewHandler(req, res) {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment) {
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
    return sendError(res, error.statusCode || 500, error.message || 'Unable to submit review.');
  }
}
