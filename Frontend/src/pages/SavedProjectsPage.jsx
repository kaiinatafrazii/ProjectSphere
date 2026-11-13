import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';

const CATALOG_PAGE_SIZE = 12;

export default function SavedProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [catalogProjects, setCatalogProjects] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [savedError, setSavedError] = useState('');
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/users/me/bookmarks')
      .then((response) => {
        if (active) setProjects(response.projects || []);
      })
      .catch((loadError) => {
        if (active) setSavedError(loadError.message || 'Unable to load saved projects.');
      })
      .finally(() => {
        if (active) setLoadingSaved(false);
      });

      setLoadingCatalog(true);
      setCatalogError('');
    apiRequest(`/projects?sort=newest&page=${catalogPage}&limit=${CATALOG_PAGE_SIZE}`)
      .then((response) => {
        if (active) {
          setCatalogProjects(response.projects || []);
          setCatalogTotal(response.total || 0);
        }
      })
      .catch(() => {
        if (active) setCatalogError('Unable to load projects to explore. Please try again later.');
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, [catalogPage]);

  return (
    <div className="page-shell narrow-page">
      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Your collection</span>
            <h1>Saved projects</h1>
            <p>Keep useful projects close and return to them anytime.</p>
          </div>
          {loadingSaved ? <div className="empty-state" role="status">Loading saved projects…</div> : null}
          {savedError ? <div className="empty-state" role="alert">{savedError}</div> : null}
          {!loadingSaved && !savedError && !projects.length ? (
            <div className="empty-state saved-empty-state">
              <strong>No saved projects yet.</strong>
              <p>Save a project from the list below and it will appear here.</p>
            </div>
          ) : null}
          {!loadingSaved && !savedError && projects.length ? (
            <>
              <h2 className="saved-section-title">Your bookmarks</h2>
              <div className="project-grid">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    initialSaved
                    onSavedChange={(saved) => {
                      if (!saved) setProjects((current) => current.filter((item) => item.id !== project.id));
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
          <div className="saved-catalog-section">
            <h2 className="saved-section-title">Explore projects</h2>
            {loadingCatalog ? <div className="empty-state" role="status">Loading projects…</div> : null}
            {catalogError ? <div className="empty-state" role="alert">{catalogError}</div> : null}
            {!loadingCatalog && !catalogError && !catalogProjects.length ? (
              <div className="empty-state">No projects are available right now.</div>
            ) : null}
            {!loadingCatalog && !catalogError && catalogProjects.length ? (
              <div className="project-grid">
                {catalogProjects
                  .filter((project) => !projects.some((saved) => saved.id === project.id))
                  .map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onSavedChange={(saved) => {
                        if (saved) setProjects((current) => [...current, project]);
                      }}
                    />
                  ))}
              </div>
            ) : null}
            {!loadingCatalog && !catalogError && catalogTotal > CATALOG_PAGE_SIZE ? (
              <nav className="pagination-controls" aria-label="More projects">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={catalogPage === 1}
                  onClick={() => setCatalogPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>Page {catalogPage} of {Math.ceil(catalogTotal / CATALOG_PAGE_SIZE)}</span>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={catalogPage >= Math.ceil(catalogTotal / CATALOG_PAGE_SIZE)}
                  onClick={() => setCatalogPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
