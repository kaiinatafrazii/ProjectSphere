import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DiscoverPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [savedProjectIds, setSavedProjectIds] = useState([]);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const [category, setCategory] = useState('all');
  const [technology, setTechnology] = useState('');
  const [filterOptions, setFilterOptions] = useState({ categories: [], technologies: [] });
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookmarkError, setBookmarkError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/projects/filters')
      .then((response) => {
        if (active) setFilterOptions({ categories: response.categories || [], technologies: response.technologies || [] });
      })
      .catch(() => {
        if (active) setFilterOptions({ categories: [], technologies: [] });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (technology) params.set('technology', technology);
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
  }, [category, technology, search, sort, page, user]);

  useEffect(() => {
    setPage(1);
  }, [category, technology, search, sort]);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('search') || '');
  }, [location.search]);

  return (
    <div className="page-shell narrow-page">
      <section className="section-block">
        <div className="container">
          <div className="section-heading discover-heading">
            <div className="discover-heading-copy">
              <span className="eyebrow">Explore the catalog</span>
              <h2>Find your next inspiration</h2>
            </div>
            {user ? (
              <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="secondary-button discover-dashboard-link">
                <span aria-hidden="true">←</span>
                Back to Dashboard
              </Link>
            ) : null}
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
              {['all', ...filterOptions.categories].map((item) => (
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
              <span>Technology</span>
              <select value={technology} onChange={(event) => setTechnology(event.target.value)}>
                <option value="">All technologies</option>
                {filterOptions.technologies.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label className="project-sort-filter">
              <span>Sort projects</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="popular">Most viewed</option>
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
