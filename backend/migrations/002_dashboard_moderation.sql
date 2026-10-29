USE projectsphere;

-- This index is required to make one review per user and project atomic.
-- Check for duplicate pairs before applying this migration; no review rows are deleted.
ALTER TABLE project_reviews
  ADD UNIQUE KEY unique_project_review_user (project_id, user_id);

ALTER TABLE users
  MODIFY role ENUM('student', 'developer', 'researcher', 'team', 'admin') NOT NULL DEFAULT 'student';

ALTER TABLE projects
  MODIFY status ENUM('draft', 'pending', 'published', 'featured', 'rejected', 'changes_requested', 'removed')
  NOT NULL DEFAULT 'pending';

CREATE TABLE project_moderation_history (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  admin_id CHAR(36) NOT NULL,
  action ENUM('approved', 'rejected', 'changes_requested', 'removed') NOT NULL,
  previous_status VARCHAR(32) NOT NULL,
  resulting_status VARCHAR(32) NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_moderation_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_moderation_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_moderation_project_created (project_id, created_at),
  INDEX idx_moderation_admin_created (admin_id, created_at)
);
