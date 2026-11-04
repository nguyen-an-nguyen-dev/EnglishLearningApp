-- Imported YouTube practice videos: owned per user, sentence segments from captions.

ALTER TABLE video_lessons
  ADD COLUMN owner_user_id BIGINT UNSIGNED NULL AFTER sort_order,
  ADD KEY idx_video_lessons_owner (owner_user_id, created_at),
  DROP INDEX uq_video_lessons_sort_order,
  ADD KEY idx_video_lessons_sort (sort_order),
  ADD CONSTRAINT fk_video_lessons_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS video_segments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  video_id BIGINT UNSIGNED NOT NULL,
  start_ms INT UNSIGNED NOT NULL,
  end_ms INT UNSIGNED NOT NULL,
  text_en TEXT NOT NULL,
  text_vi TEXT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_video_segments_video (video_id, sort_order),
  CONSTRAINT fk_video_segments_video FOREIGN KEY (video_id) REFERENCES video_lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
