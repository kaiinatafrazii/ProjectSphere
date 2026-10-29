import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { validateProjectInput } from '../utils/projectValidation.js';

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

export async function getMyDashboard(req, res) {
  try {
    const [projectRows] = await pool.execute(
      `SELECT
        COUNT(*) AS totalProjects,
        COALESCE(SUM(status IN ('published', 'featured')), 0) AS publishedProjects,
        COALESCE(SUM(status = 'pending'), 0) AS pendingProjects,
        COALESCE(SUM(status IN ('rejected', 'changes_requested')), 0) AS projectsNeedingChanges
       FROM projects WHERE user_id = ? AND status <> 'removed'`,
      [req.user.id]
    );
    const [reviewRows] = await pool.execute(
      `SELECT COUNT(r.id) AS totalReviews, AVG(r.rating) AS averageRating
       FROM project_reviews r JOIN projects p ON p.id = r.project_id
       WHERE p.user_id = ? AND p.status <> 'removed'`,
      [req.user.id]
    );
    const [savedRows] = await pool.execute(
      'SELECT COUNT(*) AS savedProjects FROM saved_projects WHERE user_id = ?',
      [req.user.id]
    );
    const [activity] = await pool.execute(
      `SELECT p.id AS projectId, p.title AS projectTitle, h.action, h.feedback, h.created_at AS createdAt
       FROM project_moderation_history h
       JOIN projects p ON p.id = h.project_id
       WHERE p.user_id = ?
       ORDER BY h.created_at DESC LIMIT 8`,
      [req.user.id]
    );
    const [recentReviews] = await pool.execute(
      `SELECT p.id AS projectId, p.title AS projectTitle, u.name AS reviewerName,
        r.rating, r.comment, r.created_at AS createdAt
       FROM project_reviews r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.user_id
       WHERE p.user_id = ? AND p.status <> 'removed'
       ORDER BY r.created_at DESC LIMIT 8`,
      [req.user.id]
    );

    return sendSuccess(res, {
      stats: {
        ...projectRows[0],
        ...reviewRows[0],
        ...savedRows[0],
        averageRating: reviewRows[0].averageRating === null
          ? null
          : Number(Number(reviewRows[0].averageRating).toFixed(1)),
      },
      recentActivity: activity,
      recentReviews,
    });
  } catch (error) {
    console.error('User dashboard retrieval failed:', error);
    return sendError(res, 500, 'Unable to load your dashboard right now.');
  }
}

export async function getMyProjects(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*,
        COALESCE(r.reviewCount, 0) AS reviewCount,
        r.ratingAverage,
        h.action AS moderationAction,
        h.feedback AS moderationFeedback,
        h.created_at AS moderationUpdatedAt
       FROM projects p
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS reviewCount, AVG(rating) AS ratingAverage
         FROM project_reviews GROUP BY project_id
       ) r ON r.project_id = p.id
       LEFT JOIN project_moderation_history h
         ON h.id = (
           SELECT h2.id FROM project_moderation_history h2
           WHERE h2.project_id = p.id ORDER BY h2.created_at DESC LIMIT 1
         )
       WHERE p.user_id = ? AND p.status <> 'removed'
       ORDER BY p.updated_at DESC`,
      [req.user.id]
    );
    const projects = rows.map((project) => ({
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      category: project.category,
      techStack: parseTechStack(project.tech_stack),
      summary: project.summary,
      overview: project.overview,
      repoUrl: project.repo_url,
      liveUrl: project.live_url,
      screenshotUrl: project.screenshot_url,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      reviewCount: Number(project.reviewCount),
      ratingAverage: project.ratingAverage === null ? null : Number(Number(project.ratingAverage).toFixed(1)),
      moderationFeedback: project.moderationFeedback,
      moderationAction: project.moderationAction,
      moderationUpdatedAt: project.moderationUpdatedAt,
    }));
    return sendSuccess(res, { projects });
  } catch (error) {
    console.error('User projects retrieval failed:', error);
    return sendError(res, 500, 'Unable to load your projects right now.');
  }
}

export async function updateMyProject(req, res) {
  const validated = validateProjectInput(req.body);
  if (validated.error) return sendError(res, 400, validated.error);
  const { title, tagline, category, techStack, summary, overview, repoUrl, liveUrl, screenshotUrl } = validated.data;

  try {
    const [result] = await pool.execute(
      `UPDATE projects SET title = ?, tagline = ?, category = ?, tech_stack = ?, summary = ?,
       overview = ?, repo_url = ?, live_url = ?, screenshot_url = ?, status = 'pending'
       WHERE id = ? AND user_id = ? AND status <> 'removed'`,
      [title, tagline, category, JSON.stringify(techStack), summary, overview, repoUrl, liveUrl, screenshotUrl, req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      const [rows] = await pool.execute('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      return rows.length
        ? sendError(res, 409, 'This project cannot be edited.')
        : sendError(res, 404, 'Project not found.');
    }
    return sendSuccess(res, { message: 'Project updated and submitted for review.' });
  } catch (error) {
    console.error('Project update failed:', error);
    return sendError(res, 500, 'Unable to update this project right now.');
  }
}

export async function deleteMyProject(req, res) {
  try {
    const [result] = await pool.execute(
      "UPDATE projects SET status = 'removed' WHERE id = ? AND user_id = ? AND status <> 'removed'",
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) return sendError(res, 404, 'Project not found.');
    return sendSuccess(res, { message: 'Project removed from your dashboard.' });
  } catch (error) {
    console.error('Project removal failed:', error);
    return sendError(res, 500, 'Unable to remove this project right now.');
  }
}
