CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bio TEXT NULL,
  avatar_url LONGTEXT NULL,
  location VARCHAR(100) NULL,
  skills JSON NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'student',
  account_status VARCHAR(16) NOT NULL DEFAULT 'active',
  username VARCHAR(40) NULL,
  github_url VARCHAR(255) NULL,
  linkedin_url VARCHAR(255) NULL,
  website_url VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_email (email),
  CONSTRAINT chk_users_role CHECK (role IN ('student', 'developer', 'researcher', 'team', 'admin')),
  CONSTRAINT chk_users_account_status CHECK (account_status IN ('active', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(150) NOT NULL,
  tagline VARCHAR(220) NOT NULL,
  category VARCHAR(80) NOT NULL,
  tech_stack JSON NULL,
  summary TEXT NOT NULL,
  overview TEXT NOT NULL,
  repo_url VARCHAR(255) NULL,
  live_url VARCHAR(255) NULL,
  screenshot_url VARCHAR(2048) NULL,
  likes INT UNSIGNED NOT NULL DEFAULT 0,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_projects_status CHECK (status IN ('draft', 'pending', 'published', 'featured', 'rejected', 'changes_requested', 'removed')),
  KEY idx_projects_user_updated (user_id, updated_at),
  KEY idx_projects_category (category),
  KEY idx_projects_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_reviews_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_project_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  UNIQUE KEY uq_project_reviews_project_user (project_id, user_id),
  KEY idx_reviews_project_created (project_id, created_at),
  KEY idx_reviews_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_projects_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved_projects_user_project (user_id, project_id),
  KEY idx_saved_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiration (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_contact_messages_is_read CHECK (is_read IN (0, 1)),
  KEY idx_contact_messages_created (created_at),
  KEY idx_contact_messages_read_created (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_moderation_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  admin_id CHAR(36) NOT NULL,
  action VARCHAR(32) NOT NULL,
  previous_status VARCHAR(32) NOT NULL,
  resulting_status VARCHAR(32) NOT NULL,
  feedback TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_moderation_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_moderation_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_moderation_action CHECK (action IN ('approved', 'rejected', 'changes_requested', 'removed')),
  KEY idx_moderation_project_created (project_id, created_at),
  KEY idx_moderation_admin_created (admin_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_source_code (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  original_filename VARCHAR(160) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_source_code_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_source_code_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_source_code_project (project_id),
  UNIQUE KEY uq_project_source_code_storage_key (storage_key),
  KEY idx_project_source_owner_submitted (owner_id, submitted_at),
  CONSTRAINT chk_project_source_size CHECK (size_bytes BETWEEN 1 AND 20971520)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  entity_type VARCHAR(32) NULL,
  entity_id CHAR(36) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_user_notifications_type CHECK (type IN ('project_approved', 'project_rejected', 'changes_requested', 'project_removed', 'new_review', 'account')),
  KEY idx_user_notifications_user_created (user_id, created_at),
  KEY idx_user_notifications_user_unread (user_id, read_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  reporter_id CHAR(36) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  details VARCHAR(3000) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  admin_id CHAR(36) NULL,
  resolution VARCHAR(3000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_project_reports_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_reports_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_project_reports_reason CHECK (reason IN ('spam', 'inappropriate', 'copyright', 'misleading', 'other')),
  CONSTRAINT chk_project_reports_status CHECK (status IN ('open', 'resolved', 'dismissed')),
  UNIQUE KEY uq_project_reports_project_reporter (project_id, reporter_id),
  KEY idx_project_reports_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_id CHAR(36) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id CHAR(36) NOT NULL,
  previous_state VARCHAR(64) NULL,
  new_state VARCHAR(64) NULL,
  details VARCHAR(3000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_audit_events_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_admin_audit_target_type CHECK (target_type IN ('user', 'report')),
  KEY idx_admin_audit_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_password_reset_tokens_hash (token_hash),
  KEY idx_password_reset_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  email_notifications TINYINT(1) NOT NULL DEFAULT 1,
  product_updates TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_user_preferences_email CHECK (email_notifications IN (0, 1)),
  CONSTRAINT chk_user_preferences_updates CHECK (product_updates IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_change_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  new_email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_change_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_email_change_tokens_hash (token_hash),
  KEY idx_email_change_user_created (user_id, created_at),
  KEY idx_email_change_expiration (expires_at, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
