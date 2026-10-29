import { query } from '../config/db.js';

export async function listProjects(filters = {}) {
  const { category, search } = filters;
  const clauses = ["status IN ('published', 'featured')"];
  const params = [];
  if (category && category !== 'all') {
    clauses.push('category = ?');
    params.push(category);
  }
  if (search) {
    clauses.push('(title LIKE ? OR tagline LIKE ? OR summary LIKE ? OR overview LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  return query(`SELECT * FROM projects WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
}

export async function findProjectById(id) {
  const rows = await query("SELECT * FROM projects WHERE id = ? AND status IN ('published', 'featured')", [id]);
  return rows[0] || null;
}

export async function listProjectReviews(projectId) {
  return query(
    'SELECT project_reviews.*, users.name AS userName FROM project_reviews JOIN users ON users.id = project_reviews.user_id WHERE project_reviews.project_id = ? ORDER BY project_reviews.created_at DESC',
    [projectId]
  );
}

export async function createProject(payload) {
  const result = await query(
    'INSERT INTO projects (id, user_id, title, tagline, category, tech_stack, summary, overview, repo_url, live_url, screenshot_url, likes, views, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      payload.id,
      payload.userId,
      payload.title,
      payload.tagline,
      payload.category,
      JSON.stringify(payload.techStack || []),
      payload.summary,
      payload.overview,
      payload.repoUrl || null,
      payload.liveUrl || null,
      payload.screenshotUrl || null,
      payload.likes || 0,
      payload.views || 0,
      payload.status || 'published',
    ]
  );
  return result;
}

export async function createReview({ id, projectId, userId, rating, comment }) {
  const result = await query(
    'INSERT INTO project_reviews (id, project_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)',
    [id, projectId, userId, rating, comment]
  );
  return result;
}
