import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [profilePhotoCleared, setProfilePhotoCleared] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', location: '', skills: '', avatarUrl: '' });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const userResponse = await apiRequest(`/users/${user.id}`);
        const projectResponse = await apiRequest('/projects');
        setProfile(userResponse.user);
        setForm({
          name: userResponse.user.name || '',
          bio: userResponse.user.bio || '',
          location: userResponse.user.location || '',
          skills: (userResponse.user.skills || []).join(', '),
          avatarUrl: userResponse.user.avatarUrl || '',
        });
        setProjects((projectResponse.projects || []).filter((project) => project.owner?.id === user.id));
      } catch (error) {
        setError(error.message || 'Unable to load your profile.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await apiRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          bio: form.bio,
          location: form.location,
          skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
          avatarUrl: form.avatarUrl.trim(),
        }),
      });
      setProfile((current) => ({ ...current, ...response.user }));
      updateUser(response.user);
      setProfilePhotoCleared(false);
      setSuccess('Your profile was updated.');
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEditing = () => {
    if (editing && profile) {
      setForm({
        name: profile.name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        skills: (profile.skills || []).join(', '),
        avatarUrl: profile.avatarUrl || '',
      });
    } else if (profile) {
      setForm({
        name: profile.name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        skills: (profile.skills || []).join(', '),
        avatarUrl: profile.avatarUrl || '',
      });
    }
    setEditing((current) => !current);
    setProfilePhotoCleared(false);
    setError('');
    setSuccess('');
  };

  const chooseProfilePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }

    setProcessingPhoto(true);
    setError('');
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 512;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        setProcessingPhoto(false);
        setError('This image could not be processed. Try another image.');
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let imageData = '';
      for (const quality of [0.78, 0.68, 0.58, 0.48]) {
        imageData = canvas.toDataURL('image/jpeg', quality);
        const base64Length = imageData.length - 'data:image/jpeg;base64,'.length;
        if (Math.ceil(base64Length * 3 / 4) <= 512000) break;
        imageData = '';
      }
      if (!imageData) {
        setProcessingPhoto(false);
        setError('This image is too detailed to save. Choose a smaller image.');
        return;
      }
      setForm((current) => ({ ...current, avatarUrl: imageData }));
      setProfilePhotoCleared(false);
      setError('');
      setSuccess('');
      setProcessingPhoto(false);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setProcessingPhoto(false);
      setError('This image could not be read. Try another image.');
    };
    image.src = objectUrl;
  };

  if (loading) {
    return <div className="page-shell center-block"><div className="empty-state" role="status">Loading your profile…</div></div>;
  }

  if (error) {
    return <div className="page-shell center-block"><div className="empty-state" role="alert">{error}</div></div>;
  }

  if (!profile && !user) {
    return <div className="page-shell center-block"><div className="empty-state">Log in to view your profile.</div></div>;
  }

  return (
    <div className="page-shell profile-page">
      <section className="section-block">
        <div className="container profile-layout">
          <div className="profile-card">
            <img src={profile?.avatarUrl || '/favicon.svg'} alt={`${profile?.name || user?.name}'s profile`} />
            <div>
              <span className="eyebrow">Creator profile</span>
              <h1>{profile?.name || user?.name}</h1>
              <p>{profile?.bio || 'This builder is ready to share impactful work.'}</p>
              <div className="tech-stack">
                {(profile?.skills || user?.skills || []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <button type="button" className="secondary-button" onClick={toggleEditing}>
                {editing ? 'Cancel editing' : 'Edit profile'}
              </button>
            </div>
          </div>

          {error ? <p className="error-text" role="alert">{error}</p> : null}
          {success ? <p className="success-text" role="status">{success}</p> : null}
          {editing ? (
            <form className="card-panel stacked-form profile-edit-form" onSubmit={saveProfile}>
              <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={100} required /></label>
              <div className="profile-photo-editor">
                <img
                  src={form.avatarUrl || (profilePhotoCleared ? '/favicon.svg' : profile?.avatarUrl || '/favicon.svg')}
                  alt="Profile photo preview"
                />
                <label>
                  Profile photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseProfilePhoto} />
                </label>
                <p className="field-help">{processingPhoto ? 'Preparing photo…' : 'JPG, PNG, or WebP, up to 5 MB. Images are resized before saving.'}</p>
                {form.avatarUrl ? <button className="link-button" type="button" onClick={() => { setForm((current) => ({ ...current, avatarUrl: '' })); setProfilePhotoCleared(true); }}>Remove profile photo</button> : null}
              </div>
              <label>Bio<textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} rows={4} maxLength={1000} /></label>
              <label>Location<input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} maxLength={100} /></label>
              <label>Skills (comma separated)<input value={form.skills} onChange={(event) => setForm((current) => ({ ...current, skills: event.target.value }))} placeholder="React, Node.js" /></label>
              <button className="primary-button" type="submit" disabled={saving || processingPhoto}>{saving ? 'Saving…' : processingPhoto ? 'Preparing photo…' : 'Save profile'}</button>
            </form>
          ) : null}

          <div className="profile-summary-grid">
            <div className="summary-box">
              <strong>{projects.length}</strong>
              <span>Published projects</span>
            </div>
            <div className="summary-box">
              <strong>{profile?.location || 'Remote'}</strong>
              <span>Location</span>
            </div>
            <div className="summary-box">
              <strong>{profile?.role || user?.role || 'student'}</strong>
              <span>Role</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">My projects</span>
            <h2>Published work</h2>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              No public projects yet. <Link to="/publish">Publish your first project</Link>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <div key={project.id} className="mini-project-card">
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <Link to={`/projects/${project.id}`} className="link-button">Open project</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
