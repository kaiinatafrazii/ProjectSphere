import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function saveProject(req, res) {
  try {
    const [projects] = await pool.execute(
      "SELECT id FROM projects WHERE id = ? AND status IN ('published', 'featured')",
      [req.params.id]
    );
    if (!projects.length) return sendError(res, 404, 'Project not found.');

    await pool.execute(
      'INSERT INTO saved_projects (id, user_id, project_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE project_id = VALUES(project_id)',
      [uuidv4(), req.user.id, req.params.id]
    );
    return sendSuccess(res, { saved: true });
  } catch (error) {
    console.error('Project bookmark failed:', error);
    return sendError(res, 500, 'Unable to save this project right now.');
  }
}

export async function removeSavedProject(req, res) {
  try {
    await pool.execute('DELETE FROM saved_projects WHERE user_id = ? AND project_id = ?', [req.user.id, req.params.id]);
    return sendSuccess(res, { saved: false });
  } catch (error) {
    console.error('Project bookmark removal failed:', error);
    return sendError(res, 500, 'Unable to remove this saved project right now.');
  }
}

export async function listSavedProjects(req, res) {
  try {
    const [projects] = await pool.execute(
      `SELECT p.id, p.title, p.tagline, p.category, p.tech_stack AS techStack,
        p.summary, p.screenshot_url AS screenshotUrl, p.created_at AS createdAt,
        u.id AS ownerId, u.name AS ownerName
       FROM saved_projects s
       JOIN projects p ON p.id = s.project_id
       JOIN users u ON u.id = p.user_id
       WHERE s.user_id = ? AND p.status IN ('published', 'featured')
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return sendSuccess(res, {
      projects: projects.map((project) => ({
        ...project,
        techStack: Array.isArray(project.techStack) ? project.techStack : JSON.parse(project.techStack || '[]'),
        owner: { id: project.ownerId, name: project.ownerName },
      })),
    });
  } catch (error) {
    console.error('Saved project listing failed:', error);
    return sendError(res, 500, 'Unable to load your saved projects right now.');
  }
}
