-- Apply once to an existing database; fresh installs already have this column in init.sql.
-- Existing rows keep working as published (the default is the migration time).
-- Admin-imported shared videos are inserted with NULL, meaning draft until an admin publishes them.
ALTER TABLE video_lessons
  ADD COLUMN published_at timestamp NULL DEFAULT current_timestamp() AFTER created_at,
  ADD KEY idx_video_lessons_published (published_at);
