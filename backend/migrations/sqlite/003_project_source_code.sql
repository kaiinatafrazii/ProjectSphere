CREATE TABLE project_source_code (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 160),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_source_owner_submitted
  ON project_source_code(owner_id, submitted_at);
