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
    const { title, tagline, category, techStack, summary, overview, repoUrl, liveUrl, screenshotUrl } = req.body;
    if (!title || !tagline || !category || !summary || !overview) {
      return sendError(res, 400, 'Please complete the required project details.');
    }
    if ([title, tagline, summary, overview].some((value) => typeof value !== 'string')) {
      return sendError(res, 400, 'Project details must be text.');
    }
    if (title.length > 150 || tagline.length > 220 || category.length > 80 || summary.length > 5000 || overview.length > 20000) {
      return sendError(res, 400, 'One or more project fields exceed the allowed length.');
    }
    if (techStack !== undefined && (!Array.isArray(techStack) || techStack.length > 30 || techStack.some((item) => typeof item !== 'string' || item.length > 40))) {
      return sendError(res, 400, 'Tech stack must contain up to 30 short text values.');
    }
    for (const url of [repoUrl, liveUrl, screenshotUrl]) {
      if (url && (!isHttpUrl(url))) {
        return sendError(res, 400, 'Project links must be valid HTTP or HTTPS URLs.');
      }
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

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return process.env.NODE_ENV === 'production'
      ? url.protocol === 'https:'
      : url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
