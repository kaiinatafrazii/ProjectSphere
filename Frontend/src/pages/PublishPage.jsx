import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

export default function PublishPage() {
  const navigate = useNavigate();
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
  const [publishing, setPublishing] = useState(false);

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
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          techStack: form.techStack.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      });
      navigate('/discover', { replace: true, state: { notice: 'Your project has been published.' } });
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
            <span className="eyebrow">Publish project</span>
            <h2>Share your work with the community</h2>
          </div>

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
                Repository URL
                <input type="url" name="repoUrl" value={form.repoUrl} onChange={handleChange} placeholder="https://github.com/your-repo" />
              </label>
              <label>
                Live URL
                <input type="url" name="liveUrl" value={form.liveUrl} onChange={handleChange} placeholder="https://your-project.app" />
              </label>
            </div>

            <label>
              Screenshot URL
              <input type="url" name="screenshotUrl" value={form.screenshotUrl} onChange={handleChange} placeholder="https://images.unsplash.com/..." />
            </label>

            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <button type="submit" className="primary-button" disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish project'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
