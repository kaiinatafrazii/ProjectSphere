import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api.js';
import { optimizedImageUrl } from '../utils/imageUrl.js';

const features = [
  {
    number: '01',
    icon: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    title: 'Discover projects',
    description: 'Explore published work from developers, students, and research teams.',
  },
  {
    number: '02',
    icon: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9h17M8 4.5v4.5" /></>,
    title: 'Showcase your work',
    description: 'Publish a project with its story, repository, live demo, and technical details.',
  },
  {
    number: '03',
    icon: <><path d="M4 6h16M7 12h10M10 18h4" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /></>,
    title: 'Search and filter',
    description: 'Narrow the project catalog by category or search by title and description.',
  },
  {
    number: '04',
    icon: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" /></>,
    title: 'Explore technologies',
    description: 'See the tools and technologies creators use on each project.',
  },
  {
    number: '05',
    icon: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.7-3.6 3.3-5.5 7.5-5.5s6.8 1.9 7.5 5.5" /></>,
    title: 'Build your profile',
    description: 'Share your background, interests, and published projects in one place.',
  },
  {
    number: '06',
    icon: <><path d="M4 5.5h16v11H11l-5 3v-3H4z" /><path d="M8 10h8M8 13h5" /></>,
    title: 'Give useful feedback',
    description: 'Leave a considered rating and review on a project detail page.',
  },
];

const steps = [
  ['01', 'Create your account', 'Set up a profile so your work and interests have a home.'],
  ['02', 'Explore or publish', 'Find projects by category, or share your own with the community.'],
  ['03', 'Connect and grow', 'Explore technologies, learn from project stories, and leave useful reviews.'],
];

export default function HomePage() {
  const navigate = useNavigate();
  const [featuredProject, setFeaturedProject] = useState(null);
  const [search, setSearch] = useState('');
  const [projectError, setProjectError] = useState('');
  const [contact, setContact] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;

    apiRequest('/projects')
      .then((response) => {
        if (!active) return;
        const items = response.projects || [];
        setFeaturedProject(items.find((project) => project.status === 'featured') || items[0] || null);
      })
      .catch(() => {
        if (active) setProjectError('Projects are unavailable right now. Please try again shortly.');
      });

    return () => {
      active = false;
    };
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/discover?search=${encodeURIComponent(query)}` : '/discover');
  };

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContact((current) => ({ ...current, [name]: value }));
    setContactError('');
    setContactSuccess('');
  };

  const submitContact = async (event) => {
    event.preventDefault();
    setContactError('');
    setContactSuccess('');
    setSending(true);

    try {
      const response = await apiRequest('/contact', {
        method: 'POST',
        body: JSON.stringify(contact),
      });
      setContact({ name: '', email: '', subject: '', message: '', website: '' });
      setContactSuccess(response.message || 'Your message has been received.');
    } catch (error) {
      setContactError(error.message || 'We could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="hero-section landing-section" id="home">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">A space for builders</span>
            <h1>Good work deserves to be discovered.</h1>
            <p>
              ProjectSphere helps developers share what they build, find ideas worth exploring, and learn from a
              community that cares about the craft.
            </p>
            <div className="hero-actions">
              <Link to="/discover" className="primary-button">Explore Projects</Link>
              <Link to="/publish" className="secondary-button">Share Your Project</Link>
            </div>
            <form className="home-search" onSubmit={submitSearch} role="search">
              <label className="visually-hidden" htmlFor="home-project-search">Search projects</label>
              <input
                id="home-project-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects by name or idea"
              />
              <button type="submit" className="secondary-button">Search</button>
            </form>
          </div>

          <div className="hero-visual">
            {featuredProject ? (
              <article className="featured-panel">
                {featuredProject.screenshotUrl ? (
                  <img
                    src={optimizedImageUrl(featuredProject.screenshotUrl, 1000)}
                    alt={`${featuredProject.title} project preview`}
                    fetchpriority="high"
                    decoding="async"
                  />
                ) : (
                  <div className="image-placeholder">Project preview unavailable</div>
                )}
                <div className="featured-panel-body">
                  <span className="pill">From the community</span>
                  <h2>{featuredProject.title}</h2>
                  <p>{featuredProject.tagline}</p>
                  <Link to={`/projects/${featuredProject.id}`} className="link-button">Explore this project</Link>
                </div>
              </article>
            ) : projectError ? (
              <div className="empty-state" role="alert">{projectError}</div>
            ) : (
              <div className="featured-placeholder">
                <span className="featured-placeholder-mark" aria-hidden="true">P</span>
                <p>Projects made by people who build.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-block landing-section about-section" id="about">
        <div className="container about-grid">
          <div className="section-heading left-aligned">
            <span className="eyebrow">About ProjectSphere</span>
            <h2>A more thoughtful home for technical projects.</h2>
          </div>
          <div className="about-copy">
            <p>
              Projects are more than a finished demo. They hold the ideas, trade-offs, tools, and teamwork behind the
              result. ProjectSphere gives developers, students, and research teams a place to share that context.
            </p>
            <p>
              Explore new approaches, learn which technologies people are using, and make your own work easier for
              others to understand and discover.
            </p>
            <Link to="/discover" className="link-button">Explore the community <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="section-block landing-section muted-section" id="features">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Made for project work</span>
            <h2>Everything you need to share and explore.</h2>
            <p>Useful tools for the full journey, from first discovery to thoughtful feedback.</p>
          </div>
          <div className="feature-grid landing-feature-grid">
            {features.map((feature) => (
              <article className="feature-card landing-feature-card" key={feature.number}>
                <span className="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">{feature.icon}</svg>
                </span>
                <span className="visually-hidden">Feature {feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block landing-section" id="how-it-works">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">How it works</span>
            <h2>Three steps. A bigger perspective.</h2>
          </div>
          <ol className="steps-grid">
            {steps.map(([number, title, description]) => (
              <li className="step-card" key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-block landing-section muted-section" id="testimonials">
        <div className="container testimonial-state">
          <div className="section-heading">
            <span className="eyebrow">Community voices</span>
            <h2>Built with the community, for the community.</h2>
          </div>
          <div className="empty-state">
            <strong>Community feedback coming soon</strong>
            <p>We’ll share verified feedback here as community members choose to contribute it.</p>
          </div>
        </div>
      </section>

      <section className="section-block landing-section contact-section" id="contact">
        <div className="container contact-grid">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Contact</span>
            <h2>Have a question or an idea?</h2>
            <p>Send a note to the ProjectSphere team. We’ll show a confirmation only when your message is accepted.</p>
          </div>
          <form className="stacked-form contact-form" onSubmit={submitContact}>
            <div className="form-grid two-up">
              <label>
                Name
                <input name="name" autoComplete="name" value={contact.name} onChange={handleContactChange} maxLength={100} required />
              </label>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" value={contact.email} onChange={handleContactChange} maxLength={255} required />
              </label>
            </div>
            <label>
              Subject
              <input name="subject" value={contact.subject} onChange={handleContactChange} maxLength={180} required />
            </label>
            <label>
              Message
              <textarea name="message" value={contact.message} onChange={handleContactChange} rows={5} maxLength={5000} required />
            </label>
            <label className="honeypot-field" aria-hidden="true">
              Website
              <input name="website" value={contact.website} onChange={handleContactChange} tabIndex={-1} autoComplete="off" />
            </label>
            {contactError ? <p className="error-text" role="alert">{contactError}</p> : null}
            {contactSuccess ? <p className="success-text" role="status">{contactSuccess}</p> : null}
            <button type="submit" className="primary-button contact-submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      </section>

    </>
  );
}
