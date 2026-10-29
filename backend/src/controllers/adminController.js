import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

const moderationActions = {
  approve: { action: 'approved', status: 'published' },
  reject: { action: 'rejected', status: 'rejected' },
  request_changes: { action: 'changes_requested', status: 'changes_requested' },
  remove: { action: 'removed', status: 'removed' },
};

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

export async function getAdminOverview(_req, res) {
  try {
    const [userCount] = await pool.execute('SELECT COUNT(*) AS totalUsers FROM users');
    const [projectCounts] = await pool.execute(
      `SELECT COUNT(*) AS totalProjects,
        COALESCE(SUM(status = 'pending'), 0) AS pendingProjects,
        COALESCE(SUM(status IN ('published', 'featured')), 0) AS publishedProjects,
        COALESCE(SUM(status = 'rejected'), 0) AS rejectedProjects
       FROM projects WHERE status <> 'removed'`
    );
    const [reviewCount] = await pool.execute('SELECT COUNT(*) AS totalReviews FROM project_reviews');
    const [recentUsers] = await pool.execute(
      'SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 5'
    );
    const [recentProjects] = await pool.execute(
      `SELECT p.id, p.title, p.status, p.created_at AS createdAt, u.name AS ownerName
       FROM projects p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 5`
    );
    return sendSuccess(res, {
      stats: { ...userCount[0], ...projectCounts[0], ...reviewCount[0] },
      recentUsers,
      recentProjects,
    });
  } catch (error) {
    console.error('Admin dashboard retrieval failed:', error);
    return sendError(res, 500, 'Unable to load the administrator dashboard.');
  }
}

export async function listAdminProjects(req, res) {
  const { page, limit, offset } = pagination(req.query);
  const allowedStatuses = new Set(['draft', 'pending', 'published', 'featured', 'rejected', 'changes_requested', 'removed', 'approved']);
  const status = typeof req.query.status === 'string' && allowedStatuses.has(req.query.status)
    ? req.query.status
    : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const where = [];
  const params = [];
  if (status === 'approved') {
    where.push("p.status IN ('published', 'featured')");
  } else if (status) {
    where.push('p.status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(p.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM projects p JOIN users u ON u.id = p.user_id ${clause}`,
      params
    );
    const [projects] = await pool.execute(
      `SELECT p.id, p.title, p.tagline, p.category, p.tech_stack AS techStack,
        p.summary, p.overview, p.repo_url AS repoUrl, p.live_url AS liveUrl,
        p.screenshot_url AS screenshotUrl, p.status, p.created_at AS createdAt,
        u.id AS ownerId, u.name AS ownerName, u.email AS ownerEmail,
        COALESCE(r.reviewCount, 0) AS reviewCount, r.ratingAverage
       FROM projects p JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS reviewCount, AVG(rating) AS ratingAverage
         FROM project_reviews GROUP BY project_id
       ) r ON r.project_id = p.id
       ${clause}
       ORDER BY CASE p.status
         WHEN 'pending' THEN 0 WHEN 'changes_requested' THEN 1 WHEN 'rejected' THEN 2
         WHEN 'draft' THEN 3 WHEN 'published' THEN 4 WHEN 'featured' THEN 5 ELSE 6
       END, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return sendSuccess(res, { projects, page, limit, total: Number(countRows[0].total) });
  } catch (error) {
    console.error('Admin project listing failed:', error);
    return sendError(res, 500, 'Unable to load project submissions.');
  }
}

export async function moderateProject(req, res) {
  const action = req.body?.action;
  const decision = moderationActions[action];
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';
  if (!decision) return sendError(res, 400, 'Choose a valid moderation action.');
  if (['rejected', 'changes_requested', 'removed'].includes(decision.action) && !feedback) {
    return sendError(res, 400, 'Feedback is required for this moderation action.');
  }
  if (feedback.length > 5000) return sendError(res, 400, 'Moderation feedback must be 5000 characters or fewer.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT status FROM projects WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      await connection.rollback();
      return sendError(res, 404, 'Project not found.');
    }
    const previousStatus = rows[0].status;
    if (previousStatus === 'removed') {
      await connection.rollback();
      return sendError(res, 409, 'Removed projects cannot be moderated again.');
    }

    await connection.execute('UPDATE projects SET status = ? WHERE id = ?', [decision.status, req.params.id]);
    await connection.execute(
      `INSERT INTO project_moderation_history
       (id, project_id, admin_id, action, previous_status, resulting_status, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), req.params.id, req.user.id, decision.action, previousStatus, decision.status, feedback || null]
    );
    await connection.commit();
    return sendSuccess(res, { message: 'Moderation decision saved.', status: decision.status });
  } catch (error) {
    await connection.rollback();
    console.error('Project moderation failed:', error);
    return sendError(res, 500, 'Unable to save the moderation decision.');
  } finally {
    connection.release();
  }
}

export async function listModerationHistory(req, res) {
  const { page, limit, offset } = pagination(req.query);
  try {
    const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM project_moderation_history');
    const [rows] = await pool.execute(
      `SELECT h.id, h.project_id AS projectId, p.title AS projectTitle,
        h.admin_id AS adminId, u.name AS adminName, h.action,
        h.previous_status AS previousStatus, h.resulting_status AS resultingStatus,
        h.feedback, h.created_at AS createdAt
       FROM project_moderation_history h
       JOIN projects p ON p.id = h.project_id
       JOIN users u ON u.id = h.admin_id
       ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return sendSuccess(res, { history: rows, page, limit, total: Number(countRows[0].total) });
  } catch (error) {
    console.error('Moderation history retrieval failed:', error);
    return sendError(res, 500, 'Unable to load moderation history.');
  }
}

export async function listAdminUsers(req, res) {
  const { page, limit, offset } = pagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const where = search ? 'WHERE u.name LIKE ? OR u.email LIKE ?' : '';
  const term = `%${search}%`;
  const params = search ? [term, term] : [];
  try {
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt,
        COUNT(p.id) AS projectCount
       FROM users u LEFT JOIN projects p ON p.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return sendSuccess(res, { users, page, limit, total: Number(countRows[0].total) });
  } catch (error) {
    console.error('Admin user listing failed:', error);
    return sendError(res, 500, 'Unable to load users.');
  }
}

export async function listAdminReviews(req, res) {
  const { page, limit, offset } = pagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const where = search ? 'WHERE p.title LIKE ? OR u.name LIKE ? OR r.comment LIKE ?' : '';
  const term = `%${search}%`;
  const params = search ? [term, term, term] : [];
  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM project_reviews r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.user_id
       ${where}`,
      params
    );
    const [reviews] = await pool.execute(
      `SELECT r.id, r.project_id AS projectId, p.title AS projectTitle,
        r.user_id AS reviewerId, u.name AS reviewerName, u.email AS reviewerEmail,
        r.rating, r.comment, r.created_at AS createdAt
       FROM project_reviews r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return sendSuccess(res, { reviews, page, limit, total: Number(countRows[0].total) });
  } catch (error) {
    console.error('Admin review listing failed:', error);
    return sendError(res, 500, 'Unable to load project reviews.');
  }
}
