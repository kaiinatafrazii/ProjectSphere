ALTER TABLE contact_messages
  ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_contact_messages_read_created
  ON contact_messages(is_read, created_at);
