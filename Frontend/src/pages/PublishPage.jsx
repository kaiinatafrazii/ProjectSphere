import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

export default function PublishPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const [form, setForm] = useState({
    title: '',
    tagline: '',
    category: 'Productivity',
    techStack: 'React, Node.js, MySQL',
    summary: '',
    overview: '',
    repoUrl: '',
    liveUrl: '',
    screenshotUrl: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [loadingProject, setLoadingProject] = useState(Boolean(editId));
  const [loadingSource, setLoadingSource] = useState(Boolean(editId));
  const [sourceArchive, setSourceArchive] = useState(null);
  const [existingSource, setExistingSource] = useState(null);

  useEffect(() => {
    if (location.state?.notice) setNotice(location.state.notice);
  }, [location.state]);

  useEffect(() => {
    if (!editId) return undefined;
    let active = true;
    apiRequest('/projects/mine')
      .then(({ projects }) => {
        const project = projects.find((item) => item.id === editId);
        if (!project) {
          setError('That project is not available in your account.');
          return;
        }
        if (active) {
          setForm({
            title: project.title,
            tagline: project.tagline,
            category: project.category,
            techStack: project.techStack.join(', '),
            summary: project.summary,
            overview: project.overview,
            repoUrl: project.repoUrl || '',
            liveUrl: project.liveUrl || '',
            screenshotUrl: project.screenshotUrl || '',
          });
          apiRequest(`/projects/${encodeURIComponent(editId)}/source-code`)
            .then(({ sourceCode }) => {
              if (active) setExistingSource(sourceCode);
            })
            .catch((sourceError) => {
              if (active) setError(sourceError.message || 'Unable to load source submission status.');
            })
            .finally(() => {
              if (active) setLoadingSource(false);
            });
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load this project.');
      })
      .finally(() => {
        if (active) setLoadingProject(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setPublishing(true);
    try {
      const payload = {
        ...form,
        techStack: form.techStack.split(',').map((item) => item.trim()).filter(Boolean),
      };
      const saved = await apiRequest(editId ? `/projects/${encodeURIComponent(editId)}` : '/projects', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const projectId = editId || saved.projectId;
      if (sourceArchive) {
        const sourceForm = new FormData();
        sourceForm.append('sourceCode', sourceArchive);
        try {
          const result = await apiRequest(`/projects/${encodeURIComponent(projectId)}/source-code`, {
            method: 'POST',
            body: sourceForm,
          });
          setExistingSource(result.sourceCode);
        } catch (uploadError) {
          navigate(`/dashboard/projects/${encodeURIComponent(projectId)}/edit`, {
            replace: true,
            state: { notice: `Project saved, but its private archive was not uploaded: ${uploadError.message}` },
          });
          return;
        }
      }
      navigate('/dashboard/projects', { replace: true, state: { notice: 'Your project was submitted for review.' } });
    } catch (error) {
      setError(error.message || 'Unable to publish your project.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="page-shell narrow-page">
      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">{editId ? 'Edit project' : 'Publish project'}</span>
            <h2>{editId ? 'Update your project' : 'Share your work with the community'}</h2>
          </div>

          {notice ? <p className="success-text" role="status">{notice}</p> : null}
          {loadingProject ? <p role="status">Loading your project…</p> : (
          <form className="stacked-form" onSubmit={handleSubmit}>
            <div className="form-grid two-up">
              <label>
                Project title
                <input name="title" value={form.title} onChange={handleChange} maxLength={150} placeholder="ProjectSphere" required />
              </label>
              <label>
                Category
                <select name="category" value={form.category} onChange={handleChange}>
                  <option>Productivity</option>
                  <option>AI/ML</option>
                  <option>Developer Tools</option>
                  <option>Research</option>
                  <option>Frontend</option>
                  <option>Backend</option>
                </select>
              </label>
            </div>

            <label>
              Tagline
              <input name="tagline" value={form.tagline} onChange={handleChange} maxLength={220} placeholder="A premium project discovery platform for developers." required />
            </label>

            <label>
              Tech stack
              <input name="techStack" value={form.techStack} onChange={handleChange} placeholder="React, Node.js, MySQL" />
            </label>

            <label>
              Summary
              <textarea name="summary" value={form.summary} onChange={handleChange} rows={3} maxLength={5000} placeholder="Short summary of the product and its value." required />
            </label>

            <label>
              Overview
              <textarea name="overview" value={form.overview} onChange={handleChange} rows={5} maxLength={20000} placeholder="Describe the problem, solution, and product story." required />
            </label>

            <div className="form-grid two-up">
              <label>
                Public repository URL (optional)
                <input type="url" name="repoUrl" value={form.repoUrl} onChange={handleChange} placeholder="https://github.com/your-public-repository" />
              </label>
              <label>
                Public live-demo URL (optional)
                <input type="url" name="liveUrl" value={form.liveUrl} onChange={handleChange} placeholder="https://your-project.app" />
              </label>
            </div>

            <label>
              Screenshot image URL
              <input type="url" name="screenshotUrl" value={form.screenshotUrl} onChange={handleChange} placeholder="https://images.unsplash.com/..." />
            </label>

            <section className="private-source-upload" aria-labelledby="private-source-heading">
              <h3 id="private-source-heading">Private source-code archive (optional)</h3>
              <p>
                A public repository URL is visible to everyone. A ZIP archive uploaded here stays private
                and can only be downloaded by administrators reviewing your project. It is never published.
              </p>
              {existingSource ? (
                <p className="field-help">Archive on file: {existingSource.originalFilename} ({Math.ceil(existingSource.sizeBytes / 1024)} KB).</p>
              ) : <p className="field-help">No private source archive submitted.</p>}
              <label>
                {existingSource ? 'Replace private ZIP archive' : 'Choose private ZIP archive'}
                <input type="file" accept=".zip,application/zip" onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = '';
                  if (file && file.size > 20 * 1024 * 1024) {
                    setError('Source-code ZIP archives must be 20 MB or smaller.');
                    return;
                  }
                  setSourceArchive(file);
                  setError('');
                }} />
              </label>
              {sourceArchive ? <p className="field-help">Selected: {sourceArchive.name}. Upload happens with the project save.</p> : null}
            </section>

            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <button type="submit" className="primary-button" disabled={publishing}>
              {publishing ? 'Submitting…' : editId ? 'Save and resubmit' : 'Submit for review'}
            </button>
          </form>
          )}
        </div>
      </section>
    </div>
  );
}
