import { createProject, createReview, findProjectById, listProjectReviews, listProjects } from '../repositories/projectRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { generateId } from './authService.js';

export async function getProjects(filters = {}) {
  const projects = await listProjects(filters);
  return Promise.all(
    projects.map(async (project) => {
      const owner = await findUserById(project.user_id || project.userId);
      const reviews = Array.isArray(project.reviews) ? project.reviews : await listProjectReviews(project.id);
      return {
        id: project.id,
        title: project.title,
        tagline: project.tagline,
        category: project.category,
        techStack: project.tech_stack ? JSON.parse(project.tech_stack) : project.techStack || [],
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
        })),
      };
    })
  );
}

export async function getProjectByIdService(id) {
  const project = await findProjectById(id);
  if (!project) return null;
  const owner = await findUserById(project.user_id || project.userId);
  const reviews = Array.isArray(project.reviews) ? project.reviews : await listProjectReviews(id);
  return {
    id: project.id,
    title: project.title,
    tagline: project.tagline,
    category: project.category,
    techStack: project.tech_stack ? JSON.parse(project.tech_stack) : project.techStack || [],
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
      rating: Number(review.rating),
      comment: review.comment,
      userName: review.userName || 'Community member',
    })),
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
    status: 'published',
  });
  return { id };
}

export async function addReviewService({ projectId, userId, rating, comment }) {
  const project = await findProjectById(projectId);
  if (!project) {
    throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
  }

  const id = generateId();
  await createReview({ id, projectId, userId, rating, comment });
  return { id, message: 'Review submitted successfully.' };
}
