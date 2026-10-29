import { createProject, createReview, findProjectById, listProjectReviews, listProjects } from '../repositories/projectRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { generateId } from './authService.js';

function parseTechStack(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getRatingSummary(reviews) {
  const count = reviews.length;
  return {
    reviewCount: count,
    ratingAverage: count
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / count).toFixed(1))
      : null,
  };
}

export async function getProjects(filters = {}) {
  const result = await listProjects(filters);
  const projects = await Promise.all(
    result.projects.map(async (project) => {
      const owner = await findUserById(project.user_id || project.userId);
      const reviews = Array.isArray(project.reviews) ? project.reviews : await listProjectReviews(project.id);
      return {
        id: project.id,
        title: project.title,
        tagline: project.tagline,
        category: project.category,
        techStack: parseTechStack(project.tech_stack ?? project.techStack),
        summary: project.summary,
        overview: project.overview,
        repoUrl: project.repo_url || project.repoUrl,
        liveUrl: project.live_url || project.liveUrl,
        screenshotUrl: project.screenshot_url || project.screenshotUrl,
        likes: Number(project.likes || 0),
        views: Number(project.views || 0),
        status: project.status,
        createdAt: project.created_at || project.createdAt,
        owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatar_url || owner.avatarUrl } : null,
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          userName: review.userName || 'Community member',
          createdAt: review.created_at || review.createdAt,
        })),
        ...getRatingSummary(reviews),
      };
    })
  );
  return { projects, total: result.total, page: result.page, limit: result.limit };
}

export async function getProjectByIdService(id) {
  const project = await findProjectById(id);
  if (!project) return null;
  const owner = await findUserById(project.user_id || project.userId);
  const reviews = Array.isArray(project.reviews) ? project.reviews : await listProjectReviews(id);
  const ownerProjects = await listProjects({ ownerId: owner?.id, excludeId: id, limit: 4 });
  return {
    id: project.id,
    title: project.title,
    tagline: project.tagline,
    category: project.category,
    techStack: parseTechStack(project.tech_stack ?? project.techStack),
    summary: project.summary,
    overview: project.overview,
    repoUrl: project.repo_url || project.repoUrl,
    liveUrl: project.live_url || project.liveUrl,
    screenshotUrl: project.screenshot_url || project.screenshotUrl,
    likes: Number(project.likes || 0),
    views: Number(project.views || 0),
    status: project.status,
    createdAt: project.created_at || project.createdAt,
    owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatar_url || owner.avatarUrl } : null,
    ownerProjects: ownerProjects.projects.map((item) => ({
      id: item.id,
      title: item.title,
      tagline: item.tagline,
      category: item.category,
      screenshotUrl: item.screenshot_url,
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: Number(review.rating),
      comment: review.comment,
      userName: review.userName || 'Community member',
      createdAt: review.created_at || review.createdAt,
    })),
    ...getRatingSummary(reviews),
  };
}

export async function publishProjectService({ userId, title, tagline, category, techStack, summary, overview, repoUrl, liveUrl, screenshotUrl }) {
  const id = generateId();
  await createProject({
    id,
    userId,
    title,
    tagline,
    category,
    techStack,
    summary,
    overview,
    repoUrl,
    liveUrl,
    screenshotUrl,
    likes: 0,
    views: 0,
    status: 'pending',
  });
  return { id };
}

export async function addReviewService({ projectId, userId, rating, comment }) {
  const project = await findProjectById(projectId);
  if (!project) {
    throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
  }
  if ((project.user_id || project.userId) === userId) {
    throw Object.assign(new Error('Project owners cannot review their own projects.'), { statusCode: 403 });
  }

  const id = generateId();
  await createReview({ id, projectId, userId, rating, comment });
  const savedReview = (await listProjectReviews(projectId)).find(
    (review) => (review.user_id || review.userId) === userId
  );
  return {
    id: savedReview?.id || id,
    message: 'Review submitted successfully. Your rating was saved.',
  };
}
