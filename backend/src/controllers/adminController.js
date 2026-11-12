import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { findUserById } from '../repositories/userRepository.js';
import { buildUserView, hashPassword, verifyPassword } from '../services/authService.js';
import { createUserNotification } from '../services/notificationService.js';

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
        COALESCE(r.reviewCount, 0) AS reviewCount, r.ratingAverage,
        s.original_filename AS sourceFilename, s.size_bytes AS sourceSizeBytes,
        s.sha256 AS sourceSha256, s.submitted_at AS sourceSubmittedAt
       FROM projects p JOIN users u ON u.id = p.user_id
       LEFT JOIN project_source_code s ON s.project_id = p.id
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

export async function getAdminProjectDetails(req, res) {
  try {
    const [projectRows] = await pool.execute(
      `SELECT p.id, p.title, p.tagline, p.category, p.tech_stack AS techStack,
        p.summary, p.overview, p.repo_url AS repoUrl, p.live_url AS liveUrl,
        p.screenshot_url AS screenshotUrl, p.status, p.created_at AS createdAt,
        p.updated_at AS updatedAt, u.id AS ownerId, u.name AS ownerName,
        u.email AS ownerEmail, s.original_filename AS sourceFilename,
        s.size_bytes AS sourceSizeBytes, s.sha256 AS sourceSha256,
        s.submitted_at AS sourceSubmittedAt
       FROM projects p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN project_source_code s ON s.project_id = p.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!projectRows.length) return sendError(res, 404, 'Project not found.');

    const [reviews] = await pool.execute(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt,
        u.name AS reviewerName, u.email AS reviewerEmail
       FROM project_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.project_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    const [reviewSummary] = await pool.execute(
      'SELECT COUNT(*) AS reviewCount, AVG(rating) AS ratingAverage FROM project_reviews WHERE project_id = ?',
      [req.params.id]
    );
    const [history] = await pool.execute(
      `SELECT h.action, h.previous_status AS previousStatus,
        h.resulting_status AS resultingStatus, h.feedback,
        h.created_at AS createdAt, u.name AS adminName
       FROM project_moderation_history h JOIN users u ON u.id = h.admin_id
       WHERE h.project_id = ? ORDER BY h.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    const project = projectRows[0];
    return sendSuccess(res, {
      project: {
        ...project,
        techStack: parseTechStack(project.techStack),
        reviewCount: Number(reviewSummary[0].reviewCount),
        ratingAverage: reviewSummary[0].ratingAverage === null
          ? null
          : Number(Number(reviewSummary[0].ratingAverage).toFixed(1)),
        sourceCode: project.sourceFilename ? {
          originalFilename: project.sourceFilename,
          sizeBytes: Number(project.sourceSizeBytes),
          sha256: project.sourceSha256,
          submittedAt: project.sourceSubmittedAt,
        } : null,
        reviews,
        history,
      },
    });
  } catch (error) {
    console.error('Admin project detail retrieval failed:', error);
    return sendError(res, 500, 'Unable to load project details.');
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
    const [rows] = await connection.execute('SELECT status, user_id AS ownerId, title FROM projects WHERE id = ?', [req.params.id]);
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
    const notificationType = decision.action === 'approved'
      ? 'project_approved'
      : decision.action === 'rejected'
        ? 'project_rejected'
        : decision.action === 'changes_requested'
          ? 'changes_requested'
          : 'project_removed';
    const notificationTitle = decision.action === 'approved'
      ? 'Your project was approved'
      : decision.action === 'rejected'
        ? 'Your project was rejected'
        : decision.action === 'changes_requested'
          ? 'Changes requested for your project'
          : 'Your project was removed';
    await createUserNotification({
      userId: rows[0].ownerId,
      type: notificationType,
      title: notificationTitle,
      message: feedback || `“${rows[0].title}” was ${decision.action}.`,
      entityType: 'project',
      entityId: req.params.id,
    }, connection);
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
      `SELECT u.id, u.name, u.email, u.role, u.account_status AS accountStatus,
        u.created_at AS createdAt,
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

export async function changeUserAccountStatus(req, res) {
    const accountStatus = req.body?.accountStatus;
    if (!['active', 'suspended'].includes(accountStatus)) {
      return sendError(res, 400, 'Choose active or suspended as the account status.');
    }
    if (accountStatus === 'suspended' && req.params.id === req.user.id) {
      return sendError(res, 409, 'You cannot suspend your own administrator account.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        'SELECT id, role, account_status AS accountStatus FROM users WHERE id = ?',
        [req.params.id]
      );
      if (!rows.length) {
        await connection.rollback();
        return sendError(res, 404, 'User not found.');
      }
      const target = rows[0];
      const previousStatus = target.accountStatus;
      if (previousStatus === accountStatus) {
        await connection.rollback();
        return sendSuccess(res, { accountStatus, message: 'Account status is unchanged.' });
      }

      if (target.role === 'admin' && accountStatus === 'suspended') {
        const [adminRows] = await connection.execute(
          "SELECT COUNT(*) AS activeAdmins FROM users WHERE role = 'admin' AND account_status = 'active'"
        );
        if (Number(adminRows[0].activeAdmins) <= 1) {
          await connection.rollback();
          return sendError(res, 409, 'The last active administrator cannot be suspended.');
        }
      }

      await connection.execute('UPDATE users SET account_status = ? WHERE id = ?', [accountStatus, req.params.id]);
      if (accountStatus === 'suspended') {
        await connection.execute(
          'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
          [req.params.id]
        );
      }
      await connection.execute(
        `INSERT INTO admin_audit_events
         (id, admin_id, action, target_type, target_id, previous_state, new_state, details)
         VALUES (?, ?, ?, 'user', ?, ?, ?, ?)`,
        [uuidv4(), req.user.id, accountStatus === 'suspended' ? 'user_suspended' : 'user_reactivated', req.params.id, previousStatus, accountStatus, null]
      );
      await createUserNotification({
        userId: req.params.id,
        type: 'account',
        title: accountStatus === 'suspended' ? 'Account suspended' : 'Account reactivated',
        message: accountStatus === 'suspended'
          ? 'Your account has been suspended. Contact the ProjectSphere team if you need assistance.'
          : 'Your account has been reactivated.',
      }, connection);
      await connection.commit();
      return sendSuccess(res, { accountStatus, message: 'User account status updated.' });
    } catch (error) {
      await connection.rollback();
      console.error('User account moderation failed:', error);
      return sendError(res, 500, 'Unable to update user account status.');
    } finally {
      connection.release();
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
  if (typeof req.body?.isRead !== 'boolean') {
    return sendError(res, 400, 'isRead must be true or false.');
  }
  try {
    const [result] = await pool.execute(
      'UPDATE contact_messages SET is_read = ? WHERE id = ?',
      [req.body.isRead ? 1 : 0, req.params.id]
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

export async function getAdminAnalytics(_req, res) {
  try {
    const [userRows] = await pool.execute(
      "SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count FROM users WHERE created_at >= date('now', 'start of month', '-11 months') GROUP BY month"
    );
    const [submissionRows] = await pool.execute(
      "SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count FROM projects WHERE created_at >= date('now', 'start of month', '-11 months') GROUP BY month"
    );
    const [approvalRows] = await pool.execute(
      "SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count FROM project_moderation_history WHERE action = 'approved' AND created_at >= date('now', 'start of month', '-11 months') GROUP BY month"
    );
    const [categoryRows] = await pool.execute(
      "SELECT category, COUNT(*) AS count FROM projects WHERE status IN ('published', 'featured') GROUP BY category ORDER BY count DESC, category COLLATE NOCASE ASC"
    );
    const [summaryRows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM projects WHERE status <> 'removed') AS totalProjects,
        (SELECT COUNT(*) FROM projects WHERE status = 'pending') AS pendingProjects,
        (SELECT COUNT(*) FROM projects WHERE status IN ('published', 'featured')) AS publishedProjects,
        (SELECT COUNT(*) FROM project_reviews) AS totalReviews`
    );

    const countByMonth = (rows) => new Map(rows.map((row) => [row.month, Number(row.count)]));
    const usersByMonth = countByMonth(userRows);
    const submissionsByMonth = countByMonth(submissionRows);
    const approvalsByMonth = countByMonth(approvalRows);
    const currentMonth = new Date();
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 11 + index, 1));
      const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
      return {
        month: key,
        label: monthDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        users: usersByMonth.get(key) || 0,
        submissions: submissionsByMonth.get(key) || 0,
        approvals: approvalsByMonth.get(key) || 0,
      };
    });

    return sendSuccess(res, {
      summary: summaryRows[0],
      monthly,
      categories: categoryRows.map((row) => ({ category: row.category, count: Number(row.count) })),
    });
  } catch (error) {
    console.error('Admin analytics retrieval failed:', error);
    return sendError(res, 500, 'Unable to load platform analytics.');
  }
}

export async function listProjectReports(req, res) {
  const { page, limit, offset } = pagination(req.query);
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push('r.status = ?');
    params.push(status);
  }
  if (search) {
    clauses.push('(p.title LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR r.details LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM project_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.reporter_id ${where}`,
      params
    );
    const [reports] = await pool.execute(
      `SELECT r.id, r.project_id AS projectId, p.title AS projectTitle,
        r.reporter_id AS reporterId, u.name AS reporterName, u.email AS reporterEmail,
        r.reason, r.details, r.status, r.resolution, r.created_at AS createdAt,
        r.resolved_at AS resolvedAt
       FROM project_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.reporter_id ${where}
       ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return sendSuccess(res, { reports, page, limit, total: Number(countRows[0].total) });
  } catch (error) {
    console.error('Project report listing failed:', error);
    return sendError(res, 500, 'Unable to load project reports.');
  }
}

export async function resolveProjectReport(req, res) {
  const status = req.body?.status;
  const resolution = typeof req.body?.resolution === 'string' ? req.body.resolution.trim() : '';
  if (!['resolved', 'dismissed'].includes(status)) return sendError(res, 400, 'Choose resolved or dismissed.');
  if (!resolution || resolution.length > 3000) return sendError(res, 400, 'A resolution note of up to 3000 characters is required.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT status FROM project_reports WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      await connection.rollback();
      return sendError(res, 404, 'Project report not found.');
    }
    if (rows[0].status !== 'open') {
      await connection.rollback();
      return sendError(res, 409, 'This project report has already been resolved.');
    }
    await connection.execute(
      'UPDATE project_reports SET status = ?, admin_id = ?, resolution = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, resolution, req.params.id]
    );
    await connection.execute(
      `INSERT INTO admin_audit_events
       (id, admin_id, action, target_type, target_id, previous_state, new_state, details)
       VALUES (?, ?, ?, 'report', ?, 'open', ?, ?)`,
      [uuidv4(), req.user.id, `report_${status}`, req.params.id, status, resolution]
    );
    await connection.commit();
    return sendSuccess(res, { status, message: 'Project report updated.' });
  } catch (error) {
    await connection.rollback();
    console.error('Project report resolution failed:', error);
    return sendError(res, 500, 'Unable to update project report.');
  } finally {
    connection.release();
  }
}
