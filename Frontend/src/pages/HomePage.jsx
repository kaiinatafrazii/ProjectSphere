import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [featuredProject, setFeaturedProject] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await apiRequest('/projects');
        setProjects(response.projects || []);
        setFeaturedProject((response.projects || []).find((project) => project.status === 'featured') || (response.projects || [])[0]);
      } catch (error) {
        setError('Projects are unavailable right now. Please try again shortly.');
      }
    }

    loadProjects();
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/discover?search=${encodeURIComponent(query)}` : '/discover');
  };

  return (
    <div className="page-shell">
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Built for ambitious builders</span>
            <h1>Discover remarkable work. Publish your next big idea.</h1>
            <p>
              ProjectSphere helps students, researchers, and product teams share technical work, get meaningful feedback,
              and find the right collaborators for their next milestone.
            </p>
            <div className="hero-actions">
              <Link to="/discover" className="primary-button">Explore projects</Link>
              <Link to="/publish" className="secondary-button">Publish a project</Link>
            </div>
            <form className="home-search" onSubmit={submitSearch} role="search">
              <label className="visually-hidden" htmlFor="home-project-search">Search projects</label>
              <input
                id="home-project-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects, ideas, or technologies"
              />
              <button type="submit" className="secondary-button">Search</button>
            </form>
          </div>

          <div className="hero-visual">
            {featuredProject ? (
              <div className="featured-panel">
                <img src={featuredProject.screenshotUrl} alt={featuredProject.title} />
                <div className="featured-panel-body">
                  <span className="pill">Featured launch</span>
                  <h3>{featuredProject.title}</h3>
                  <p>{featuredProject.tagline}</p>
                  <Link to={`/projects/${featuredProject.id}`} className="link-button">
                    Explore case study
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Featured work</span>
            <h2>Fresh ideas from the community</h2>
          </div>
          {error ? <div className="empty-state" role="alert">{error}</div> : null}
          {!error && projects.length === 0 ? <div className="empty-state">No projects have been published yet.</div> : null}
          <div className="project-grid three-up">
            {(projects || []).slice(0, 3).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-block muted-section">
        <div className="container feature-stack">
          <div className="feature-copy">
            <span className="eyebrow">Why builders stay</span>
            <h2>Project discovery designed for technical work.</h2>
          </div>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Focused discovery</h3>
              <p>Search by technical stack, category, and project maturity to find the best work that fits your goals.</p>
            </div>
            <div className="feature-card">
              <h3>Meaningful feedback</h3>
              <p>Review submissions with structured ratings and comments to help teams improve the next iteration.</p>
            </div>
            <div className="feature-card">
              <h3>Profile-driven trust</h3>
              <p>Showcase technical depth and experience with a professional profile built for real opportunities.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
