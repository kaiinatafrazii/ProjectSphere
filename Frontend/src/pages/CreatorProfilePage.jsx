import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';

export default function CreatorProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError('');
      try {
        const [profileResponse, projectResponse] = await Promise.all([
          apiRequest(`/users/${encodeURIComponent(id)}`),
          apiRequest(`/projects?ownerId=${encodeURIComponent(id)}&limit=50`),
        ]);
        if (active) {
          setProfile(profileResponse.user);
          setProjects(projectResponse.projects || []);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load this public profile.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="page-shell center-block"><div className="empty-state" role="status">Loading creator profile…</div></div>;
  if (error || !profile) {
    return <div className="page-shell center-block"><div className="empty-state" role="alert">{error || 'Creator not found.'}<p><Link to="/explore">Explore projects</Link></p></div></div>;
  }

  return (
    <div className="page-shell profile-page">
      <section className="section-block">
        <div className="container">
          <div className="profile-card public-creator-profile">
            <img src={profile.avatarUrl || '/favicon.svg'} alt="" />
            <div>
              <span className="eyebrow">ProjectSphere creator</span>
              <h1>{profile.name}</h1>
              {profile.location ? <p>{profile.location}</p> : null}
              {profile.bio ? <p>{profile.bio}</p> : null}
              {profile.skills?.length ? <div className="tech-stack">{profile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : null}
            </div>
          </div>
          <section className="section-block">
            <div className="section-heading left-aligned"><span className="eyebrow">Published work</span><h2>Projects by {profile.name}</h2></div>
            {projects.length ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">No published projects yet.</div>}
          </section>
        </div>
      </section>
    </div>
  );
}
