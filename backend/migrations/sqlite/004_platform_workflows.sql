ALTER TABLE users
  ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'suspended'));

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN github_url TEXT;
ALTER TABLE users ADD COLUMN linkedin_url TEXT;
ALTER TABLE users ADD COLUMN website_url TEXT;

CREATE UNIQUE INDEX idx_users_username
  ON users(username COLLATE NOCASE) WHERE username IS NOT NULL;

CREATE TABLE user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'project_approved', 'project_rejected', 'changes_requested', 'project_removed', 'new_review', 'account'
  )),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  entity_type TEXT,
  entity_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_notifications_user_created
  ON user_notifications(user_id, created_at DESC);
CREATE INDEX idx_user_notifications_user_unread
  ON user_notifications(user_id, read_at, created_at DESC);

CREATE TABLE project_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'copyright', 'misleading', 'other')),
  details TEXT NOT NULL DEFAULT '' CHECK (length(details) <= 3000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  admin_id TEXT,
  resolution TEXT CHECK (resolution IS NULL OR length(resolution) <= 3000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (project_id, reporter_id)
);

CREATE INDEX idx_project_reports_status_created
  ON project_reports(status, created_at DESC);

CREATE TABLE admin_audit_events (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'report')),
  target_id TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  details TEXT CHECK (details IS NULL OR length(details) <= 3000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_admin_audit_events_created
  ON admin_audit_events(created_at DESC);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_user_created
  ON password_reset_tokens(user_id, created_at DESC);