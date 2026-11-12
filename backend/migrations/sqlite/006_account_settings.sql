CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications INTEGER NOT NULL DEFAULT 1 CHECK (email_notifications IN (0, 1)),
  product_updates INTEGER NOT NULL DEFAULT 1 CHECK (product_updates IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE email_change_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  new_email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_change_user_created
  ON email_change_tokens(user_id, created_at DESC);
CREATE INDEX idx_email_change_expiration
  ON email_change_tokens(expires_at, consumed_at);