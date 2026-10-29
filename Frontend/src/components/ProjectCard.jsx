import { Link } from 'react-router-dom';

export default function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className="project-card-image-wrap">
        <img src={project.screenshotUrl} alt={project.title} className="project-card-image" />
      </div>
      <div className="project-card-content">
        <div className="card-meta-row">
          <span className="pill">{project.category}</span>
          <span className="muted-text">{project.views} views</span>
        </div>
        <h3>{project.title}</h3>
        <p className="project-tagline">{project.tagline}</p>
        <p className="project-summary">{project.summary}</p>
        <div className="tech-stack">
          {(project.techStack || []).slice(0, 4).map((tech) => (
            <span key={tech}>{tech}</span>
          ))}
        </div>
        <div className="card-footer">
          <div className="owner-line">
            <img src={project.owner?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80'} alt={project.owner?.name || 'Project owner'} />
            <span>{project.owner?.name || 'Community project'}</span>
          </div>
          <Link to={`/projects/${project.id}`} className="link-button">
            View project
          </Link>
        </div>
      </div>
    </article>
  );
}
