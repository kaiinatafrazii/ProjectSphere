import { query } from '../config/db.js';

export async function listProjects(filters = {}) {
  const { category, search } = filters;
  const rows = await query('SELECT * FROM projects ORDER BY created_at DESC');

  return rows.filter((project) => {
    const matchesCategory = !category || category === 'all' || project.category === category;
    const needle = search ? search.toLowerCase() : '';
    const matchesSearch = !search || [project.title, project.tagline, project.summary].join(' ').toLowerCase().includes(needle);
    return matchesCategory && matchesSearch;
  });
}

export async function findProjectById(id) {
  const rows = await query('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] || null;
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
    'INSERT INTO project_reviews (id, project_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [id, projectId, userId, rating, comment]
  );
  return result;
}
