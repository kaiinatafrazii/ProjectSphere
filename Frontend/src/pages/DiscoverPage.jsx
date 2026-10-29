import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const categories = ['all', 'Productivity', 'AI/ML', 'Developer Tools', 'Research', 'Frontend', 'Backend'];

export default function DiscoverPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [savedProjectIds, setSavedProjectIds] = useState([]);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookmarkError, setBookmarkError] = useState('');

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (search.trim()) params.set('search', search.trim());
        params.set('sort', sort);
        params.set('page', String(page));
        params.set('limit', '12');

        const response = await apiRequest(`/projects?${params.toString()}`);
        setProjects(response.projects || []);
        setTotal(response.total || 0);
        if (user) {
          try {
            const saved = await apiRequest('/users/me/bookmarks');
            setSavedProjectIds((saved.projects || []).map((project) => project.id));
            setBookmarkError('');
          } catch (savedError) {
            setBookmarkError(savedError.message || 'Saved-project status is unavailable.');
          }
        } else {
          setSavedProjectIds([]);
          setBookmarkError('');
        }
      } catch (error) {
        setProjects([]);
        setError('Unable to load projects. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [category, search, sort, page, user]);

  useEffect(() => {
    setPage(1);
  }, [category, search, sort]);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '');
  }, [location.search]);

  return (
    <div className="page-shell narrow-page">
      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Explore the catalog</span>
            <h2>Find your next inspiration</h2>
          </div>

          <div className="toolbar">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by project name or keyword"
              className="search-input"
              aria-label="Search projects"
            />
            <div className="category-filter">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === category ? 'filter-chip active' : 'filter-chip'}
                  aria-pressed={item === category}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="project-sort-filter">
              <span>Sort projects</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="rating">Highest rated</option>
                <option value="title">Title A–Z</option>
              </select>
            </label>
          </div>

          {location.state?.notice ? <p className="success-text" role="status">{location.state.notice}</p> : null}
          {bookmarkError ? <p className="error-text" role="status">{bookmarkError}</p> : null}
          {loading ? (
            <div className="empty-state" role="status">Loading projects…</div>
          ) : error ? (
            <div className="empty-state" role="alert">{error}</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">No projects match your filters yet.</div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  initialSaved={savedProjectIds.includes(project.id)}
                  onSavedChange={(saved) => setSavedProjectIds((current) => saved
                    ? [...new Set([...current, project.id])]
                    : current.filter((id) => id !== project.id))}
                />
              ))}
            </div>
          )}
          {!loading && !error && total > 12 ? (
            <nav className="pagination-controls" aria-label="Project pages">
              <button className="secondary-button" type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <span>Page {page} of {Math.ceil(total / 12)}</span>
              <button className="secondary-button" type="button" disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((current) => current + 1)}>Next</button>
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
