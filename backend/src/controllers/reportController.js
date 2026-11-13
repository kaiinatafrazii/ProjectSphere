import { randomUUID } from 'node:crypto';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

const allowedReasons = new Set(['spam', 'inappropriate', 'copyright', 'misleading', 'other']);

export async function submitProjectReport(req, res) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  if (!allowedReasons.has(reason)) return sendError(res, 400, 'Choose a valid report reason.');
  if (details.length > 3000) return sendError(res, 400, 'Report details must be 3000 characters or fewer.');

  try {
    const [projects] = await pool.execute(
      "SELECT id, user_id AS ownerId FROM projects WHERE id = ? AND status IN ('published', 'featured')",
      [req.params.id]
    );
    if (!projects.length) return sendError(res, 404, 'Project not found.');
    if (projects[0].ownerId === req.user.id) return sendError(res, 403, 'You cannot report your own project.');

    await pool.execute(
      'INSERT INTO project_reports (id, project_id, reporter_id, reason, details) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), req.params.id, req.user.id, reason, details]
    );
    return sendSuccess(res, { message: 'Your report was sent to the moderation team.' }, 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'You have already reported this project.');
    }
    console.error('Project report submission failed:', error);
    return sendError(res, 500, 'Unable to submit the report.');
  }
}