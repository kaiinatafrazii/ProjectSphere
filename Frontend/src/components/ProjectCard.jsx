import { Link } from 'react-router-dom';
import { optimizedImageUrl } from '../utils/imageUrl.js';

export default function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className="project-card-image-wrap">
        {project.screenshotUrl ? (
          <img
            src={optimizedImageUrl(project.screenshotUrl, 720)}
            alt={`${project.title} project preview`}
            className="project-card-image"
            loading="lazy"
            decoding="async"
          />
        ) : <div className="image-placeholder card-image-placeholder">Preview unavailable</div>}
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
            <img src={optimizedImageUrl(project.owner?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde', 120)} alt="" loading="lazy" decoding="async" />
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
