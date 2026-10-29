import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { findUserById } from '../repositories/userRepository.js';
import { buildUserView, hashPassword, verifyPassword } from '../services/authService.js';

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
    const [ratingSummary] = await pool.execute('SELECT AVG(rating) AS averageRating FROM project_reviews');
    const [contactCount] = await pool.execute('SELECT COUNT(*) AS unreadContactMessages FROM contact_messages WHERE is_read = 0');
    const [recentUsers] = await pool.execute(
      'SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 5'
    );
    const [recentProjects] = await pool.execute(
      `SELECT p.id, p.title, p.status, p.created_at AS createdAt, u.name AS ownerName
       FROM projects p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 5`
    );
    const [pendingProjects] = await pool.execute(
      `SELECT p.id, p.title, p.status, p.created_at AS createdAt, u.name AS ownerName
       FROM projects p JOIN users u ON u.id = p.user_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC LIMIT 5`
    );
    const [recentReviews] = await pool.execute(
      `SELECT r.id, p.id AS projectId, p.title AS projectTitle,
        u.name AS reviewerName, r.rating, r.comment, r.created_at AS createdAt
       FROM project_reviews r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT 5`
    );
    const [recentActivity] = await pool.execute(
      `SELECT h.id, p.id AS projectId, p.title AS projectTitle, h.action,
        h.feedback, h.created_at AS createdAt, u.name AS adminName
       FROM project_moderation_history h
       JOIN projects p ON p.id = h.project_id
       JOIN users u ON u.id = h.admin_id
       ORDER BY h.created_at DESC LIMIT 5`
    );
    return sendSuccess(res, {
      stats: {
        ...userCount[0],
        ...projectCounts[0],
        ...reviewCount[0],
        averageRating: ratingSummary[0].averageRating === null
          ? null
          : Number(Number(ratingSummary[0].averageRating).toFixed(1)),
        unreadContactMessages: contactCount[0].unreadContactMessages,
      },
      recentUsers,
      recentProjects,
      pendingProjects,
      recentReviews,
      recentActivity,
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
    return sendSuccess(res, {
      projects: projects.map((project) => ({ ...project, techStack: parseTechStack(project.techStack) })),
      page,
      limit,
      total: Number(countRows[0].total),
    });
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
  const clauses = [];
  const params = [];
  if (search) {
    clauses.push('(u.name LIKE ? OR u.email LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  const role = typeof req.query.role === 'string' ? req.query.role : '';
  if (['student', 'developer', 'researcher', 'team', 'admin'].includes(role)) {
    clauses.push('u.role = ?');
    params.push(role);
  }
  const createdAfter = typeof req.query.createdAfter === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.createdAfter)
    ? req.query.createdAfter
    : '';
  if (createdAfter) {
    clauses.push('date(u.created_at) >= date(?)');
    params.push(createdAfter);
  }
  const createdBefore = typeof req.query.createdBefore === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.createdBefore)
    ? req.query.createdBefore
    : '';
  if (createdBefore) {
    clauses.push('date(u.created_at) <= date(?)');
    params.push(createdBefore);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  try {
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.created_at AS createdAt,
        COUNT(DISTINCT p.id) AS projectCount,
        COUNT(DISTINCT CASE WHEN p.status IN ('published', 'featured') THEN p.id END) AS approvedProjectCount,
        COUNT(DISTINCT CASE WHEN p.status = 'pending' THEN p.id END) AS pendingProjectCount,
        COUNT(DISTINCT CASE WHEN p.status = 'rejected' THEN p.id END) AS rejectedProjectCount,
        (SELECT COUNT(*) FROM project_reviews r WHERE r.user_id = u.id) AS reviewCount
       FROM users u LEFT JOIN projects p ON p.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at ${sort}, u.name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return sendSuccess(res, {
      users: users.map((user) => ({
        ...user,
        projectCount: Number(user.projectCount),
        approvedProjectCount: Number(user.approvedProjectCount),
        pendingProjectCount: Number(user.pendingProjectCount),
        rejectedProjectCount: Number(user.rejectedProjectCount),
        reviewCount: Number(user.reviewCount),
      })),
      page,
      limit,
      total: Number(countRows[0].total),
    });
  } catch (error) {
    console.error('Admin user listing failed:', error);
    return sendError(res, 500, 'Unable to load users.');
  }
}

export async function getAdminUserDetails(req, res) {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found.');
    const [projectRows] = await pool.execute(
      `SELECT p.id, p.title, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM projects p WHERE p.user_id = ? AND p.status <> 'removed'
       ORDER BY p.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    const [reviewRows] = await pool.execute(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt,
        p.id AS projectId, p.title AS projectTitle
       FROM project_reviews r JOIN projects p ON p.id = r.project_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    const projects = projectRows.map((project) => ({
      ...project,
      moderationFeedback: null,
    }));
    for (const project of projects) {
      const [feedbackRows] = await pool.execute(
        `SELECT feedback FROM project_moderation_history
         WHERE project_id = ? AND feedback IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [project.id]
      );
      project.moderationFeedback = feedbackRows[0]?.feedback || null;
    }
    return sendSuccess(res, {
      user: buildUserView(user),
      projects,
      reviews: reviewRows,
      stats: {
        totalProjects: projects.length,
        approvedProjects: projects.filter((project) => ['published', 'featured'].includes(project.status)).length,
        pendingProjects: projects.filter((project) => project.status === 'pending').length,
        rejectedProjects: projects.filter((project) => project.status === 'rejected').length,
        reviewsWritten: reviewRows.length,
      },
    });
  } catch (error) {
    console.error('Admin user detail retrieval failed:', error);
    return sendError(res, 500, 'Unable to load user details.');
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

  export async function listAdminContactMessages(req, res) {
    const { page, limit, offset } = pagination(req.query);
    const unreadOnly = req.query.unread === 'true';
    const where = unreadOnly ? 'WHERE is_read = 0' : '';
    try {
      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM contact_messages ${where}`);
      const [messages] = await pool.execute(
        `SELECT id, name, email, subject, message, is_read AS isRead, created_at AS createdAt
         FROM contact_messages ${where}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return sendSuccess(res, { messages, page, limit, total: Number(countRows[0].total) });
    } catch (error) {
      console.error('Admin contact message listing failed:', error);
      return sendError(res, 500, 'Unable to load contact messages.');
    }
  }

  export async function markContactMessageRead(req, res) {
    try {
      const [result] = await pool.execute(
        'UPDATE contact_messages SET is_read = ? WHERE id = ?',
        [req.body?.isRead === false ? 0 : 1, req.params.id]
      );
      if (!result.affectedRows) return sendError(res, 404, 'Contact message not found.');
      return sendSuccess(res, { message: 'Contact message updated.' });
    } catch (error) {
      console.error('Admin contact message update failed:', error);
      return sendError(res, 500, 'Unable to update contact message.');
    }
  }

  export async function getAdminProfile(req, res) {
    try {
      const user = await findUserById(req.user.id);
      if (!user || user.role !== 'admin') return sendError(res, 403, 'Administrator access required.');
      return sendSuccess(res, { user: buildUserView(user) });
    } catch (error) {
      console.error('Admin profile retrieval failed:', error);
      return sendError(res, 500, 'Unable to load administrator profile.');
    }
  }

  export async function changeAdminPassword(req, res) {
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return sendError(res, 400, 'Enter your current password and a new password.');
    }
    if (newPassword.length < 12 || newPassword.length > 72) {
      return sendError(res, 400, 'The new password must be between 12 and 72 characters.');
    }
    try {
      const user = await findUserById(req.user.id);
      if (!user || user.role !== 'admin') return sendError(res, 403, 'Administrator access required.');
      if (!(await verifyPassword(currentPassword, user.password_hash))) {
        return sendError(res, 401, 'Current password is incorrect.');
      }
      const passwordHash = await hashPassword(newPassword);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
        await connection.execute(
          'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL',
          [req.user.id, req.user.sid]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return sendSuccess(res, { message: 'Password changed. Other active sessions have been signed out.' });
    } catch (error) {
      console.error('Admin password update failed:', error);
      return sendError(res, 500, 'Unable to change your password.');
    }
  }
}
