import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';

const categories = ['all', 'Productivity', 'AI/ML', 'Developer Tools', 'Research', 'Frontend', 'Backend'];

export default function DiscoverPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (search.trim()) params.set('search', search.trim());

        const response = await apiRequest(`/projects?${params.toString()}`);
        setProjects(response.projects || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [category, search]);

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
            />
            <div className="category-filter">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === category ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="empty-state">No projects match your filters yet.</div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
