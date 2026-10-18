USE english_learning;

-- Run once against an existing database before deploying the AI Talk backend.
ALTER TABLE chats
  ADD COLUMN topic ENUM(
    'DAILY_CONVERSATION', 'TRAVEL', 'FOOD', 'SHOPPING',
    'SCHOOL', 'FAMILY', 'HOBBIES', 'JOB_INTERVIEW'
  ) NOT NULL DEFAULT 'DAILY_CONVERSATION' AFTER user_id;

ALTER TABLE messages
  MODIFY COLUMN role VARCHAR(16) NOT NULL;

UPDATE messages
SET role = CASE
  WHEN BINARY role = 'user' THEN 'USER'
  WHEN BINARY role = 'assistant' THEN 'AI'
  ELSE 'SYSTEM'
END;

ALTER TABLE messages
  MODIFY COLUMN role ENUM('USER', 'AI', 'SYSTEM') NOT NULL;

ALTER TABLE ai_feedback
  ADD COLUMN type ENUM('GRAMMAR', 'VOCABULARY', 'TENSE', 'WORD_ORDER', 'OTHER')
    NOT NULL DEFAULT 'OTHER' AFTER message_id,
  ADD COLUMN original_text TEXT NULL AFTER type;

UPDATE ai_feedback f
JOIN messages m ON m.id = f.message_id
SET f.original_text = m.content,
    f.corrected_text = COALESCE(f.corrected_text, m.content),
    f.explanation = COALESCE(f.explanation, '');

ALTER TABLE ai_feedback
  MODIFY COLUMN original_text TEXT NOT NULL,
  MODIFY COLUMN corrected_text TEXT NOT NULL,
  MODIFY COLUMN explanation TEXT NOT NULL,
  DROP INDEX uq_ai_feedback_message,
  ADD KEY idx_ai_feedback_message (message_id);

CREATE TABLE learning_answer_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_learning_attempt_user_correct_date (user_id, is_correct, created_at),
  KEY idx_learning_attempt_question (question_id),
  CONSTRAINT fk_learning_attempt_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_learning_attempt_question FOREIGN KEY (question_id) REFERENCES questions (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
