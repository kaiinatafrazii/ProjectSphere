import { query } from '../config/db.js';

export async function listProjects(filters = {}) {
  const { category, search, ownerId, technology } = filters;
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(filters.limit, 10) || 12));
  const offset = (page - 1) * limit;
  const clauses = ["status IN ('published', 'featured')"];
  const params = [];
  if (category && category !== 'all') {
    clauses.push('category = ?');
    params.push(category);
  }
  if (technology) {
    clauses.push('EXISTS (SELECT 1 FROM json_each(projects.tech_stack) AS tech WHERE tech.value = ? COLLATE NOCASE)');
    params.push(technology);
  }
  if (search) {
    clauses.push('(title LIKE ? OR tagline LIKE ? OR summary LIKE ? OR overview LIKE ? OR tech_stack LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }
  if (ownerId) {
    clauses.push('user_id = ?');
    params.push(ownerId);
  }
  if (filters.excludeId) {
    clauses.push('id <> ?');
    params.push(filters.excludeId);
  }
  const where = clauses.join(' AND ');
  const sortOrder = {
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
    rating: '(SELECT AVG(rating) FROM project_reviews WHERE project_id = projects.id) DESC, created_at DESC',
    popular: 'views DESC, likes DESC, created_at DESC',
    title: 'title COLLATE NOCASE ASC',
  }[filters.sort] || 'created_at DESC';
  const [rows, countRows] = await Promise.all([
    query(`SELECT * FROM projects WHERE ${where} ORDER BY ${sortOrder} LIMIT ? OFFSET ?`, [...params, limit, offset]),
    query(`SELECT COUNT(*) AS total FROM projects WHERE ${where}`, params),
  ]);
  return { projects: rows, total: Number(countRows[0].total), page, limit };
}

export async function getProjectFilterOptions() {
  const categories = await query(
    "SELECT DISTINCT category FROM projects WHERE status IN ('published', 'featured') ORDER BY category COLLATE NOCASE"
  );
  const technologies = await query(
    `SELECT DISTINCT tech.value AS technology
     FROM projects, json_each(projects.tech_stack) AS tech
     WHERE projects.status IN ('published', 'featured') AND tech.type = 'text'
     ORDER BY tech.value COLLATE NOCASE`
  );
  return {
    categories: categories.map((row) => row.category),
    technologies: technologies.map((row) => row.technology),
  };
}

export async function findProjectById(id) {
  const rows = await query("SELECT * FROM projects WHERE id = ? AND status IN ('published', 'featured')", [id]);
  return rows[0] || null;
}

export async function incrementProjectViews(id) {
  return query('UPDATE projects SET views = views + 1 WHERE id = ?', [id]);
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
    `INSERT INTO project_reviews (id, project_id, user_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (project_id, user_id) DO UPDATE SET
       rating = excluded.rating,
       comment = excluded.comment,
       updated_at = CURRENT_TIMESTAMP`,
    [id, projectId, userId, rating, comment]
  );
  return result;
}
