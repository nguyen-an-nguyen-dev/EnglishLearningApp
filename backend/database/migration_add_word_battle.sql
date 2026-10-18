-- Run this after the main database/schema.sql on MySQL or MariaDB.
-- Safe to run again: existing columns, indexes, and vocabulary are preserved.
CREATE DATABASE IF NOT EXISTS english_learning
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE english_learning;

CREATE TABLE IF NOT EXISTS battle_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prompt_vi VARCHAR(500) NOT NULL,
  answer_en VARCHAR(500) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_battle_questions_sort_order (sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @battle_schema = DATABASE();

SET @battle_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'completed_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'finished_at'
  ),
  'ALTER TABLE matches ADD COLUMN finished_at TIMESTAMP NULL AFTER completed_at',
  'SELECT 1'
);
PREPARE battle_statement FROM @battle_sql;
EXECUTE battle_statement;
DEALLOCATE PREPARE battle_statement;

SET @battle_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'match_answers' AND COLUMN_NAME = 'question_id'
      AND IS_NULLABLE = 'NO'
  ),
  'ALTER TABLE match_answers MODIFY COLUMN question_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE battle_statement FROM @battle_sql;
EXECUTE battle_statement;
DEALLOCATE PREPARE battle_statement;

SET @battle_sql = IF(
  NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'match_answers' AND COLUMN_NAME = 'round'
  ),
  'ALTER TABLE match_answers ADD COLUMN round SMALLINT UNSIGNED NULL AFTER question_id',
  'SELECT 1'
);
PREPARE battle_statement FROM @battle_sql;
EXECUTE battle_statement;
DEALLOCATE PREPARE battle_statement;

SET @battle_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'match_answers' AND COLUMN_NAME = 'round'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @battle_schema AND TABLE_NAME = 'match_answers'
      AND INDEX_NAME = 'uq_match_answers_round'
  ),
  'ALTER TABLE match_answers ADD UNIQUE KEY uq_match_answers_round (match_id, user_id, round)',
  'SELECT 1'
);
PREPARE battle_statement FROM @battle_sql;
EXECUTE battle_statement;
DEALLOCATE PREPARE battle_statement;

INSERT INTO battle_questions (prompt_vi, answer_en, sort_order) VALUES
  ('mèo', 'cat', 1),
  ('chó', 'dog', 2),
  ('táo', 'apple', 3),
  ('sách', 'book', 4),
  ('nước', 'water', 5),
  ('nhà', 'house', 6),
  ('trường', 'school', 7),
  ('bạn', 'friend', 8),
  ('vui', 'happy', 9),
  ('nhanh', 'fast', 10),
  ('đẹp', 'beautiful', 11),
  ('ăn', 'eat', 12),
  ('uống', 'drink', 13),
  ('chạy', 'run', 14),
  ('đọc', 'read', 15),
  ('viết', 'write', 16),
  ('lớn', 'big', 17),
  ('nhỏ', 'small', 18),
  ('lạnh', 'cold', 19),
  ('nóng', 'hot', 20)
ON DUPLICATE KEY UPDATE
  prompt_vi = VALUES(prompt_vi),
  answer_en = VALUES(answer_en);
