-- ============================================================================
-- 0. KHỞI TẠO MÔI TRƯỜNG & DATABASE (MARIADB 12.2.2)
-- ============================================================================
DROP DATABASE IF EXISTS english_learning;

CREATE DATABASE english_learning
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE english_learning;

START TRANSACTION;

-- ============================================================================
-- 1. XÂY DỰNG CẤU TRÚC BẢNG (SCHEMA DEFINITION)
-- ============================================================================

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  streak SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stages_code (code),
  UNIQUE KEY uq_stages_sort_order (sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stage_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL,
  title VARCHAR(120) NOT NULL,
  topic VARCHAR(120) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lessons_code (code),
  UNIQUE KEY uq_lessons_stage_order (stage_id, sort_order),
  KEY idx_lessons_stage (stage_id),
  CONSTRAINT fk_lessons_stage FOREIGN KEY (stage_id) REFERENCES stages (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lesson_id BIGINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(40) NOT NULL DEFAULT 'multiple_choice',
  explanation TEXT NULL,
  audio_url VARCHAR(2048) NULL,
  word_bank JSON NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  sort_order TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_questions_lesson_order (lesson_id, sort_order),
  KEY idx_questions_lesson (lesson_id),
  CONSTRAINT fk_questions_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_answers_question_text (question_id, answer_text),
  UNIQUE KEY uq_answers_question_order (question_id, sort_order),
  KEY idx_answers_question_correct (question_id, is_correct),
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES questions (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
  score DECIMAL(5,2) NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_progress_user_lesson (user_id, lesson_id),
  KEY idx_progress_lesson (lesson_id),
  KEY idx_progress_user_status (user_id, status),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE badges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  icon VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_badges_code (code)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_badges (
  user_id BIGINT UNSIGNED NOT NULL,
  badge_id BIGINT UNSIGNED NOT NULL,
  awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_id),
  KEY idx_user_badges_badge (badge_id),
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_badges_badge FOREIGN KEY (badge_id) REFERENCES badges (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  topic ENUM('DAILY_CONVERSATION', 'TRAVEL', 'FOOD', 'SHOPPING', 'SCHOOL', 'FAMILY', 'HOBBIES', 'JOB_INTERVIEW') NOT NULL DEFAULT 'DAILY_CONVERSATION',
  title VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chats_user_updated (user_id, updated_at),
  CONSTRAINT fk_chats_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chat_id BIGINT UNSIGNED NOT NULL,
  role ENUM('USER', 'AI', 'SYSTEM') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_chat_created (chat_id, created_at),
  CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES chats (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_feedback (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NOT NULL,
  type ENUM('GRAMMAR', 'VOCABULARY', 'TENSE', 'WORD_ORDER', 'OTHER') NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  rating ENUM('helpful', 'not_helpful') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_feedback_message (message_id),
  CONSTRAINT fk_ai_feedback_message FOREIGN KEY (message_id) REFERENCES messages (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_one_id BIGINT UNSIGNED NOT NULL,
  player_two_id BIGINT UNSIGNED NOT NULL,
  stage_id BIGINT UNSIGNED NULL,
  status ENUM('pending', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  winner_user_id BIGINT UNSIGNED NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_matches_player_one (player_one_id, created_at),
  KEY idx_matches_player_two (player_two_id, created_at),
  KEY idx_matches_status (status, created_at),
  KEY idx_matches_stage (stage_id),
  KEY idx_matches_winner (winner_user_id),
  CONSTRAINT fk_matches_player_one FOREIGN KEY (player_one_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_matches_player_two FOREIGN KEY (player_two_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_matches_stage FOREIGN KEY (stage_id) REFERENCES stages (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_matches_winner FOREIGN KEY (winner_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE battle_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prompt_vi VARCHAR(500) NOT NULL,
  answer_en VARCHAR(500) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_battle_questions_sort_order (sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NULL,
  round SMALLINT UNSIGNED NULL,
  answer_id BIGINT UNSIGNED NULL,
  answer_text VARCHAR(500) NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  response_time_ms INT UNSIGNED NULL,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_answers_attempt (match_id, user_id, question_id),
  UNIQUE KEY uq_match_answers_round (match_id, user_id, round),
  KEY idx_match_answers_user (user_id, match_id),
  KEY idx_match_answers_question (question_id),
  KEY idx_match_answers_answer (answer_id),
  CONSTRAINT fk_match_answers_match FOREIGN KEY (match_id) REFERENCES matches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_match_answers_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_match_answers_question FOREIGN KEY (question_id) REFERENCES questions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_match_answers_answer FOREIGN KEY (answer_id) REFERENCES answers (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  file_name VARCHAR(255) NULL,
  original_text TEXT NOT NULL,
  source_language VARCHAR(16) NOT NULL,
  translated_text TEXT NOT NULL,
  target_language VARCHAR(16) NOT NULL,
  provider VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_translations_user_created (user_id, created_at),
  CONSTRAINT fk_translations_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. NẠP DỮ LIỆU HỆ THỐNG (BADGES, STAGES, LESSONS)
-- ============================================================================

INSERT INTO badges (code, name, description, icon) VALUES
  ('first_lesson', 'First Lesson', 'Complete your first lesson.', 'school'),
  ('lessons_10', '10 Lessons Completed', 'Complete 10 lessons.', 'workspace_premium'),
  ('xp_100', '100 XP', 'Earn 100 XP.', 'bolt'),
  ('xp_500', '500 XP', 'Earn 500 XP.', 'military_tech');

INSERT INTO stages (code, title, description, sort_order) VALUES
  ('stage-1', 'A1 Beginner Basics', 'Xây dựng nền tảng từ vựng và câu giao tiếp căn bản hàng ngày.', 1),
  ('stage-2', 'A2 Elementary Communication', 'Giao tiếp trong các tình huống quen thuộc và mua sắm, đi lại.', 2),
  ('stage-3', 'B1 Intermediate Skills', 'Tự tin xử lý tình huống khi du lịch, học tập và phỏng vấn.', 3),
  ('stage-4', 'B2 Upper-Intermediate Business', 'Làm chủ tiếng Anh công sở, cuộc họp, email và đàm phán.', 4),
  ('stage-5', 'C1 Advanced Fluency', 'Bày tỏ quan điểm sâu sắc, kể chuyện và diễn đạt ý tưởng phức tạp.', 5),
  ('stage-6', 'C2 Mastery & Proficiency', 'Thành thạo như người bản xứ, làm chủ thành ngữ và văn phong học thuật.', 6);

INSERT INTO lessons (stage_id, code, title, topic, sort_order) VALUES
  -- Stage 1 (A1)
  (1, 's1-greetings', 'Chào hỏi & Phép lịch sự', 'Greetings', 1),
  (1, 's1-introductions', 'Giới thiệu bản thân', 'Introductions', 2),
  (1, 's1-numbers', 'Con số & Đếm số', 'Numbers', 3),
  (1, 's1-family', 'Thành viên gia đình', 'Family', 4),
  (1, 's1-food', 'Thức ăn & Đồ uống hàng ngày', 'Food', 5),
  -- Stage 2 (A2)
  (2, 's2-food', 'Ẩm thực & Gọi món', 'Food', 1),
  (2, 's2-shopping', 'Mua sắm & Hỏi giá', 'Shopping', 2),
  (2, 's2-daily-activities', 'Hoạt động thường nhật', 'Daily Activities', 3),
  (2, 's2-transportation', 'Phương tiện & Giao thông', 'Transportation', 4),
  (2, 's2-hobbies', 'Sở thích & Giải trí', 'Hobbies', 5),
  -- Stage 3 (B1)
  (3, 's3-travel', 'Du lịch & Khách sạn', 'Travel', 1),
  (3, 's3-school', 'Trường học & Giáo dục', 'School', 2),
  (3, 's3-hobbies', 'Giải trí & Hoạt động ngoài trời', 'Hobbies', 3),
  (3, 's3-job-interview', 'Phỏng vấn xin việc', 'Job Interview', 4),
  (3, 's3-technology', 'Công nghệ & Cuộc sống hiện đại', 'Technology', 5),
  -- Stage 4 (B2)
  (4, 's4-telephone', 'Giao tiếp qua điện thoại', 'Telephone Calls', 1),
  (4, 's4-meetings', 'Cuộc họp & Thảo luận', 'Meetings', 2),
  (4, 's4-emails', 'Viết Email thương mại', 'Emails', 3),
  (4, 's4-workplace', 'Giao tiếp chốn công sở', 'At the Workplace', 4),
  (4, 's4-negotiation', 'Đàm phán kinh doanh', 'Negotiation', 5),
  -- Stage 5 (C1)
  (5, 's5-opinions', 'Bày tỏ quan điểm', 'Sharing Opinions', 1),
  (5, 's5-storytelling', 'Kỹ năng kể chuyện', 'Storytelling', 2),
  (5, 's5-goals', 'Kế hoạch & Mục tiêu', 'Plans and Goals', 3),
  (5, 's5-discussion', 'Tranh luận chuyên sâu', 'Discussion', 4),
  (5, 's5-review', 'Ôn tập giao tiếp nâng cao', 'Everyday Review', 5),
  -- Stage 6 (C2)
  (6, 's6-idioms', 'Thành ngữ & Cụm động từ nâng cao', 'Idioms', 1),
  (6, 's6-academic', 'Từ vựng học thuật cao cấp', 'Academic', 2),
  (6, 's6-grammar', 'Cấu trúc ngữ pháp phức tạp', 'Grammar', 3),
  (6, 's6-rhetoric', 'Nghệ thuật hùng biện & Văn phong', 'Rhetoric', 4),
  (6, 's6-masterclass', 'Tổng hợp tinh hoa C2', 'Masterclass', 5);

-- ============================================================================
-- 3. KHỞI TẠO BẢNG TẠM CHO TOÀN BỘ 300 CÂU HỎI (STAGE 1 ĐẾN 6)
-- ============================================================================

DROP TEMPORARY TABLE IF EXISTS seed_questions;
DROP TEMPORARY TABLE IF EXISTS seed_word_order_questions;
DROP TEMPORARY TABLE IF EXISTS seed_listening_questions;
DROP TEMPORARY TABLE IF EXISTS seed_fill_choice_questions;
DROP TEMPORARY TABLE IF EXISTS seed_listen_choice_questions;

CREATE TEMPORARY TABLE seed_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  distractor_one VARCHAR(500) NOT NULL,
  distractor_two VARCHAR(500) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE seed_word_order_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  word_bank JSON NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE seed_listening_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  word_bank JSON NOT NULL,
  audio_url VARCHAR(2048) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE seed_fill_choice_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  distractor_one VARCHAR(500) NOT NULL,
  distractor_two VARCHAR(500) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE seed_listen_choice_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  audio_url VARCHAR(2048) NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  distractor_one VARCHAR(500) NOT NULL,
  distractor_two VARCHAR(500) NOT NULL,
  distractor_three VARCHAR(500) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. NẠP DỮ LIỆU ĐẦY ĐỦ 30 BÀI (MULTIPLE CHOICE)
-- ============================================================================
INSERT INTO seed_questions (lesson_code, sort_order, question_text, correct_answer, distractor_one, distractor_two) VALUES
  -- Stage 1
  ('s1-greetings', 1, 'Lời chào nào thường dùng vào buổi sáng?', 'Good morning', 'Good night', 'Goodbye'),
  ('s1-greetings', 2, 'Dịch câu sau sang tiếng Việt: "Thank you very much."', 'Cảm ơn bạn rất nhiều.', 'Xin lỗi bạn rất nhiều.', 'Chúc bạn ngủ ngon.'),
  ('s1-greetings', 8, 'Đâu là cách chào thân mật với bạn bè?', 'Hi!', 'Farewell!', 'Good night!'),
  ('s1-greetings', 9, 'Câu "Good night" được dùng trong hoàn cảnh nào?', 'Chào tạm biệt trước khi đi ngủ', 'Chào lần đầu gặp vào buổi sáng', 'Chào đồng nghiệp giờ ăn trưa'),
  ('s1-greetings', 10, 'Chọn từ đúng để hoàn thành câu chào: "Nice to ___ you."', 'meet', 'see', 'look'),
  ('s1-introductions', 1, 'Để trả lời cho câu hỏi "What is your name?", bạn sẽ nói:', 'My name is Lina.', 'I am 20 years old.', 'I live in Hanoi.'),
  ('s1-introductions', 2, 'Dịch câu sau sang tiếng Việt: "Where are you from?"', 'Bạn đến từ đâu?', 'Bạn bao nhiêu tuổi?', 'Bạn làm nghề gì?'),
  ('s1-introductions', 8, 'Đâu là cách giới thiệu một người bạn với người khác?', 'This is my friend, Peter.', 'Peter is a student.', 'I like Peter very much.'),
  ('s1-introductions', 9, 'Khi lần đầu gặp mặt ai đó, bạn nên nói:', 'Nice to meet you.', 'Good night.', 'See you yesterday.'),
  ('s1-introductions', 10, 'Chọn từ đúng: "I am ___ Vietnam."', 'from', 'at', 'on'),
  ('s1-numbers', 1, 'Số "7" trong tiếng Anh được viết là gì?', 'seven', 'seventy', 'six'),
  ('s1-numbers', 2, 'Từ "thirteen" tương ứng với số nào?', 'Số 13', 'Số 3', 'Số 30'),
  ('s1-numbers', 8, 'Một tá (one dozen) trong tiếng Anh có số lượng là bao nhiêu?', '12', '10', '20'),
  ('s1-numbers', 9, 'Từ "twenty" trong tiếng Anh có nghĩa là gì?', 'Số 20', 'Số 12', 'Số 2'),
  ('s1-numbers', 10, 'Chọn từ đúng để điền tuổi: "I am ___ years old." (Tôi 10 tuổi)', 'ten', 'tenth', 'time'),
  ('s1-family', 1, 'Mẹ của mẹ bạn trong tiếng Anh gọi là gì?', 'grandmother', 'aunt', 'sister'),
  ('s1-family', 2, 'Dịch từ sau sang tiếng Việt: "uncle"', 'Chú / Bác / Cậu', 'Anh trai', 'Ông nội'),
  ('s1-family', 8, 'Từ "mother" có nghĩa là gì?', 'Mẹ', 'Bố', 'Bà'),
  ('s1-family', 9, 'Dạng số nhiều của từ "child" (đứa trẻ) là gì?', 'children', 'childs', 'childes'),
  ('s1-family', 10, 'Chọn từ phù hợp: "She is my ___ sister." (Cô ấy là em gái tôi)', 'younger', 'small', 'short'),
  ('s1-food', 1, 'Loại quả nào có vỏ màu vàng và dễ bóc?', 'banana', 'apple', 'orange'),
  ('s1-food', 2, 'Dịch từ sau sang tiếng Việt: "breakfast"', 'Bữa ăn sáng', 'Bữa ăn trưa', 'Bữa ăn tối'),
  ('s1-food', 8, 'Chúng ta thường dùng cái gì để uống nước?', 'a glass', 'a spoon', 'a knife'),
  ('s1-food', 9, 'Đồ uống nào được pha từ lá trà?', 'Tea', 'Milk', 'Juice'),
  ('s1-food', 10, 'Chọn động từ đúng: "I want to ___ an apple."', 'eat', 'drink', 'sleep'),

  -- Stage 2
  ('s2-food', 1, 'Thực phẩm nào làm từ sữa và thường cắt thành lát?', 'cheese', 'rice', 'lettuce'),
  ('s2-food', 2, 'Dịch câu sau sang tiếng Việt: "I am very thirsty."', 'Tôi đang rất khát nước.', 'Tôi đang rất đói bụng.', 'Tôi đang rất mệt mỏi.'),
  ('s2-food', 8, 'Bữa ăn trưa trong tiếng Anh gọi là gì?', 'lunch', 'breakfast', 'dinner'),
  ('s2-food', 9, 'Câu nào dùng để xin xem thực đơn lịch sự nhất?', 'Could I see the menu, please?', 'Give me the menu now.', 'I want to buy a menu.'),
  ('s2-food', 10, 'Từ "sweet" dùng để miêu tả hương vị nào?', 'Ngọt', 'Mặn', 'Chua'),
  ('s2-shopping', 1, 'Câu hỏi nào dùng để hỏi giá tiền món đồ?', 'How much does this cost?', 'How tall is this item?', 'How old is this store?'),
  ('s2-shopping', 2, 'Từ trái nghĩa với "expensive" (đắt) là gì?', 'cheap', 'heavy', 'large'),
  ('s2-shopping', 8, 'Vật dụng dùng để đựng đồ tạp hóa mang về nhà:', 'a shopping bag', 'a pillowcase', 'a pencil case'),
  ('s2-shopping', 9, 'Dịch cụm từ sau sang tiếng Việt: "try it on"', 'Mặc thử đồ', 'Thanh toán tiền', 'Đổi trả hàng'),
  ('s2-shopping', 10, 'Câu nào dùng để hỏi thanh toán bằng thẻ ngân hàng?', 'Can I pay by card?', 'Can I show my card?', 'Can I keep this card?'),
  ('s2-daily-activities', 1, 'Hoạt động "get out of bed" có nghĩa là gì?', 'Thức dậy bước ra khỏi giường', 'Đi ngủ đúng giờ', 'Dọn dẹp phòng ngủ'),
  ('s2-daily-activities', 2, 'Dịch cụm từ sau sang tiếng Việt: "take a shower"', 'Tắm vòi hoa sen', 'Đi dạo buổi sáng', 'Chụp một bức ảnh'),
  ('s2-daily-activities', 8, 'Hành động nào giúp giữ phòng ngủ sạch sẽ?', 'tidy the room', 'leave the room', 'paint the room'),
  ('s2-daily-activities', 9, 'Câu nào miêu tả thói quen đi bộ đi học hàng ngày?', 'She walks to school every day.', 'She walked to school yesterday.', 'She will walk to school tomorrow.'),
  ('s2-daily-activities', 10, 'Bữa ăn tối trong tiếng Anh gọi là gì?', 'dinner', 'breakfast', 'lunch'),
  ('s2-transportation', 1, 'Hành khách thường đứng chờ tàu hỏa ở đâu?', 'at the train station', 'at the airport', 'at the bus stop'),
  ('s2-transportation', 2, 'Phương tiện nào di chuyển trên đường ray?', 'a train', 'a bicycle', 'a bus'),
  ('s2-transportation', 8, 'Câu hỏi nào dùng để hỏi giờ xe buýt chạy?', 'When does the bus leave?', 'Where is the bus driver?', 'How much is the bus?'),
  ('s2-transportation', 9, 'Người lái xe taxi trong tiếng Anh gọi là gì?', 'a taxi driver', 'a taxi passenger', 'a taxi manager'),
  ('s2-transportation', 10, 'Từ trái nghĩa với "left" (bên trái) là gì?', 'right', 'straight', 'behind'),
  ('s2-hobbies', 1, 'Sở thích chụp ảnh trong tiếng Anh là gì?', 'photography', 'gardening', 'cooking'),
  ('s2-hobbies', 2, 'Động từ nào dùng khi chơi nhạc cụ như guitar?', 'play', 'read', 'draw'),
  ('s2-hobbies', 8, 'Từ "hobby" có nghĩa là gì?', 'Sở thích lúc rảnh rỗi', 'Công việc hàng ngày', 'Kế hoạch tương lai'),
  ('s2-hobbies', 9, 'Câu nào dùng để rủ bạn cùng chơi tennis?', 'Would you like to play tennis with me?', 'Do you know how to make tennis?', 'Where can I buy a tennis?'),
  ('s2-hobbies', 10, 'Hoạt động đọc sách nơi yên tĩnh là sở thích gì?', 'reading', 'swimming', 'running'),

  -- Stage 3
  ('s3-travel', 1, 'Giấy tờ quan trọng nhất khi làm thủ tục xuất nhập cảnh là gì?', 'a passport', 'a library card', 'a credit card'),
  ('s3-travel', 2, 'Khu vực nhận lại hành lý sau chuyến bay ở sân bay gọi là gì?', 'baggage claim', 'check-in desk', 'departure gate'),
  ('s3-travel', 8, 'Thông tin nào cho biết chính xác giờ máy bay cất cánh?', 'departure time', 'flight number', 'gate number'),
  ('s3-travel', 9, 'Dịch câu sau sang tiếng Anh: "Thẻ lên máy bay"', 'boarding pass', 'hotel receipt', 'bus ticket'),
  ('s3-travel', 10, 'Cách hỏi đường đến bảo tàng lịch sự nhất:', 'Excuse me, how do I get to the museum?', 'Where is the museum now?', 'Show me the museum path.'),
  ('s3-school', 1, 'Vật dụng học sinh dùng để ghi chép bài giảng trên lớp:', 'a notebook', 'a textbook', 'a dictionary'),
  ('s3-school', 2, 'Dịch từ sau sang tiếng Việt: "teacher"', 'Giáo viên', 'Học sinh', 'Hiệu trưởng'),
  ('s3-school', 8, 'Bạn nên làm gì khi không hiểu câu hỏi của thầy cô?', 'Hỏi thầy cô giải thích lại', 'Giấu không nói ra', 'Bỏ ra về ngay'),
  ('s3-school', 9, 'Câu nào sau đây chia ở thì Quá khứ đơn (Past Simple)?', 'We studied for the test yesterday.', 'We study for the test tomorrow.', 'We are studying for the test.'),
  ('s3-school', 10, 'Thời khóa biểu lớp học cho bạn biết điều gì?', 'Thời gian và môn học trong tuần', 'Giá sách giáo khoa', 'Danh sách bạn cùng lớp'),
  ('s3-hobbies', 1, 'Sở thích chụp ảnh sử dụng thiết bị chuyên dụng nào?', 'a camera', 'a phone charger', 'a computer screen'),
  ('s3-hobbies', 2, 'Động từ đi kèm khi chơi nhạc cụ:', 'play', 'make', 'do'),
  ('s3-hobbies', 8, 'Hoạt động đi bộ dã ngoại ngoài trời gọi là gì?', 'hiking', 'swimming', 'skating'),
  ('s3-hobbies', 9, 'Dịch câu sau: "Would you like to play tennis with me?"', 'Bạn có muốn chơi tennis với tôi không?', 'Bạn có biết chơi tennis không?', 'Bạn mua vợt tennis ở đâu?'),
  ('s3-hobbies', 10, 'Ý nghĩa câu "I am interested in art":', 'Tôi rất quan tâm đến nghệ thuật.', 'Tôi không thích nghệ thuật.', 'Tôi là một họa sĩ nổi tiếng.'),
  ('s3-job-interview', 1, 'Lời chào mở đầu buổi phỏng vấn chuyên nghiệp:', 'Good morning, it is nice to meet you.', 'Hi there, give me the job.', 'Hello, why are you here?'),
  ('s3-job-interview', 2, 'Câu hỏi kiểm tra kinh nghiệm làm việc cũ của nhà tuyển dụng:', 'Could you tell me about your previous work?', 'What did you eat for breakfast?', 'Where do you go on vacation?'),
  ('s3-job-interview', 8, 'Từ "strength" trong buổi phỏng vấn có nghĩa là gì?', 'Điểm mạnh kỹ năng', 'Điểm yếu cần khắc phục', 'Mức lương mong muốn'),
  ('s3-job-interview', 9, 'Lời cảm ơn kết thúc buổi phỏng vấn trang trọng:', 'Thank you for your time.', 'I will call you later.', 'Give me the job now.'),
  ('s3-job-interview', 10, 'Cách trả lời ngày có thể bắt đầu làm việc rõ ràng:', 'I can start on the first of June.', 'I will start whenever I want.', 'I am starting yesterday.'),
  ('s3-technology', 1, 'Thiết bị di động bỏ túi dùng truy cập mạng phổ biến nhất:', 'a smartphone', 'a desktop PC', 'a printer'),
  ('s3-technology', 2, 'Mạng "Wi-Fi" giúp thiết bị thực hiện điều gì?', 'Kết nối mạng không dây', 'In tài liệu tự động', 'Sạc pin nhanh chóng'),
  ('s3-technology', 8, 'Mật khẩu ("password") có vai trò gì?', 'Bảo mật tài khoản cá nhân', 'Đổi tên thiết bị', 'Tăng tốc độ mạng'),
  ('s3-technology', 9, 'Hành động tải tệp tin lên máy chủ mạng gọi là gì?', 'uploading', 'downloading', 'deleting'),
  ('s3-technology', 10, 'Bản cập nhật phần mềm (software update) mang lại điều gì?', 'Tính năng mới và sửa lỗi bảo mật', 'Xóa toàn bộ dữ liệu', 'Tắt nguồn thiết bị vĩnh viễn'),

  -- Stage 4
  ('s4-telephone', 1, 'Cách lịch sự để xin nói chuyện với ai đó qua điện thoại:', 'May I speak to Alex, please?', 'Give me Alex right now.', 'Connect me to Alex fast.'),
  ('s4-telephone', 2, 'Bạn nên nói gì khi không nghe rõ người gọi ở đầu dây bên kia?', 'Could you repeat that, please?', 'You are talking too softly.', 'I cannot hear anything.'),
  ('s4-telephone', 8, 'Câu hỏi lịch sự khi người cần gặp đang bận nghe điện thoại khác:', 'Would you like to leave a message?', 'Call back in five minutes.', 'Hang up the phone now.'),
  ('s4-telephone', 9, 'Ý nghĩa cụm từ "hold on" trong cuộc gọi điện thoại:', 'Chờ giữ máy một chút', 'Tắt máy ngay lập tức', 'Nói to hơn nữa'),
  ('s4-telephone', 10, 'Cách giới thiệu bản thân và bộ phận làm việc khi gọi điện:', 'This is David calling from marketing.', 'I am David from marketing team.', 'David is calling you now.'),
  ('s4-meetings', 1, 'Cách ngắt lời lịch sự để bổ sung ý kiến trong cuộc họp:', 'May I add something here?', 'Listen to me right now.', 'Stop talking for a moment.'),
  ('s4-meetings', 2, 'Câu thể hiện sự đồng ý với đề xuất của đồng nghiệp:', 'I agree with your suggestion.', 'Your suggestion is okay.', 'I accept your suggestion.'),
  ('s4-meetings', 8, 'Mục đích chính của "agenda" trong cuộc họp công sở:', 'Tóm tắt các chủ đề thảo luận', 'Danh sách người tham dự', 'Thời gian nghỉ giải lao'),
  ('s4-meetings', 9, 'Cách đề nghị đồng nghiệp nhắc lại điểm vừa trình bày:', 'Could you say that again, please?', 'Repeat your point now.', 'I missed your point completely.'),
  ('s4-meetings', 10, 'Cụm từ "wrap up" cuộc họp có nghĩa là gì?', 'Tổng kết và kết thúc cuộc họp', 'Hủy bỏ cuộc họp', 'Bắt đầu cuộc họp'),
  ('s4-emails', 1, 'Mục đích chính của dòng tiêu đề email (subject line):', 'Tóm tắt chủ đề chính của email', 'Ghi thông tin người gửi', 'Thay thế nội dung email'),
  ('s4-emails', 2, 'Lời xưng hô trang trọng đúng chuẩn trong email công việc:', 'Dear Ms. Nguyen,', 'Hello my friend,', 'Hi there boss,'),
  ('s4-emails', 8, 'Từ viết tắt "CC" trong email nghĩa là gì?', 'Carbon Copy', 'Computer Code', 'Contact Customer'),
  ('s4-emails', 9, 'Lời kết email công việc chuyên nghiệp:', 'Best regards,', 'See you later,', 'Cheers,'),
  ('s4-emails', 10, 'Lưu ý quan trọng trước khi nhấn nút "Reply All" trong email:', 'Xác nhận tất cả mọi người có cần nhận thông tin không', 'Xóa toàn bộ tệp đính kèm', 'Đổi lại tiêu đề email'),
  ('s4-workplace', 1, 'Cách nhờ đồng nghiệp hỗ trợ công việc lịch sự:', 'Could you help me with this task, please?', 'Do this task for me now.', 'I need you to complete this.'),
  ('s4-workplace', 2, 'Khái niệm "project deadline" nghĩa là gì?', 'Hạn chót hoàn thành dự án', 'Bắt đầu triển khai dự án', 'Người quản lý dự án'),
  ('s4-workplace', 8, 'Yếu tố quan trọng nhất của "teamwork" công sở:', 'Hợp tác hiệu quả với đồng nghiệp', 'Cạnh tranh cá nhân', 'Thực hiện công việc độc lập'),
  ('s4-workplace', 9, 'Từ "colleague" trong môi trường làm việc nghĩa là gì?', 'Đồng nghiệp', 'Khách hàng', 'Đối thủ'),
  ('s4-workplace', 10, 'Cách đề nghị sếp làm rõ chi tiết công việc:', 'Could you clarify the main requirements for this project?', 'Why is this task so complicated?', 'I do not understand this work.'),
  ('s4-negotiation', 1, 'Mục tiêu chính của cuộc đàm phán kinh doanh (negotiation):', 'Đạt thỏa thuận đôi bên cùng có lợi', 'Giành chiến thắng tuyệt đối', 'Hủy bỏ hợp đồng kinh doanh'),
  ('s4-negotiation', 2, 'Khái niệm "win-win situation" trong đàm phán nghĩa là gì?', 'Giải pháp cả hai bên đều có lợi', 'Chỉ một bên đạt mục đích', 'Cả hai bên cùng chịu thiệt'),
  ('s4-negotiation', 8, 'Sự nhượng bộ lẫn nhau để đi đến thống nhất gọi là gì?', 'compromise', 'conflict', 'cancellation'),
  ('s4-negotiation', 9, 'Cách đưa ra mức chiết khấu đối ứng lịch sự:', 'We could offer a 10% discount instead.', 'Take this discount or leave it.', 'This is our discounted price.'),
  ('s4-negotiation', 10, 'Cách đưa ra điều kiện ưu đãi khi ký hợp đồng:', 'If you sign today, we can include free shipping.', 'Sign now to get free shipping.', 'Free shipping is only for today.'),

  -- Stage 5
  ('s5-opinions', 1, 'Which expression introduces a personal viewpoint effectively?', 'In my opinion, this approach is best.', 'I think this approach is best.', 'My viewpoint is this approach.'),
  ('s5-opinions', 2, 'How can you politely disagree with an idea during a discussion?', 'I see your point, but I have a different perspective.', 'I completely disagree with your wrong idea.', 'Your idea makes no sense to me.'),
  ('s5-opinions', 8, 'Which phrase expresses partial agreement with a reservation?', 'I agree with you to some extent, however...', 'I agree with everything you just said.', 'I do not agree with anything you said.'),
  ('s5-opinions', 9, 'How to ask for a colleague opinion on a complex matter?', 'What are your thoughts on this matter?', 'What do you think about this thing?', 'Do you have any opinion now?'),
  ('s5-opinions', 10, 'Which expression strongly emphasizes conviction?', 'There is no doubt in my mind that this works.', 'I guess this might work somehow.', 'Maybe this will work or not.'),
  ('s5-storytelling', 1, 'Which transition word opens the narrative sequence?', 'First of all,', 'In conclusion,', 'Consequently,'),
  ('s5-storytelling', 2, 'Which phrase describes a subsequent event smoothly?', 'Shortly after that,', 'Before that happens,', 'At the same time,'),
  ('s5-storytelling', 8, 'Which adverb introduces an unexpected plot twist?', 'Suddenly,', 'Gradually,', 'Normally,'),
  ('s5-storytelling', 9, 'How do you conclude an engaging personal anecdote?', 'All in all, it was an unforgettable experience.', 'That is the end of my short story.', 'I have nothing more to say now.'),
  ('s5-storytelling', 10, 'Which word describes a high-tension narrative moment?', 'Tense', 'Calm', 'Simple'),
  ('s5-goals', 1, 'Which sentence conveys a firm future intention?', 'I am fully committed to completing this project.', 'I plan to do this project sometime.', 'I might complete this project later.'),
  ('s5-goals', 2, 'Dịch câu sau: "I hope to achieve greater confidence."', 'Tôi hy vọng sẽ đạt được sự tự tin lớn hơn.', 'Tôi đã tự tin hơn ngày hôm qua.', 'Tôi muốn học cách tự tin hơn.'),
  ('s5-goals', 8, 'What does the term "ambition" represent in a career context?', 'A strong drive and determination to succeed', 'A desire to finish work quickly', 'A habit of planning daily tasks'),
  ('s5-goals', 9, 'Which expression highlights dedication to a long-term goal?', 'I am determined to reach this milestone.', 'I hope I can reach this milestone.', 'I will try to reach this milestone.'),
  ('s5-goals', 10, 'What is a "milestone" in project roadmap execution?', 'A significant stage or event in development', 'The final deadline of the project', 'A minor task on the to-do list'),
  ('s5-discussion', 1, 'Which phrase transitions smoothly to a counterargument?', 'On the other hand, we must consider the risk.', 'In addition, we must consider the risk.', 'For instance, we must consider the risk.'),
  ('s5-discussion', 2, 'How do you summarize the core issue of a complex debate?', 'In short, the underlying issue is efficiency.', 'Briefly speaking, the debate is over.', 'To sum up, everyone agrees today.'),
  ('s5-discussion', 8, 'What does the term "implication" signify in policy discussions?', 'A likely consequence or future effect', 'A direct order from management', 'A clear statement of facts'),
  ('s5-discussion', 9, 'Which phrase stresses the vital importance of a trend?', 'It is essential to address this key trend.', 'We should look at this trend maybe.', 'This trend is somewhat interesting.'),
  ('s5-discussion', 10, 'How to express objective neutrality on a debated subject?', 'I remain neutral until more evidence emerges.', 'I do not care about either side.', 'Both sides are completely wrong.'),
  ('s5-review', 1, 'Which phrasing politely requests clarification on a point?', 'Could you elaborate on what you mean by that?', 'Why did you say that just now?', 'Explain your point once again.'),
  ('s5-review', 2, 'Which phrase concludes a conversation gracefully?', 'It has been a pleasure speaking with you.', 'Goodbye, I am leaving now.', 'Thanks for talking to me today.'),
  ('s5-review', 8, 'How do you express deep gratitude for professional support?', 'I truly appreciate your unwavering support.', 'Thank you for helping me out.', 'Your support was very good.'),
  ('s5-review', 9, 'Which phrase confirms you follow a complex argument?', 'I completely follow your reasoning.', 'I understand what you said.', 'I agree with your reasoning.'),
  ('s5-review', 10, 'What is the most constructive way to resolve a conflict?', 'Address the misunderstanding through clear dialogue.', 'Avoid speaking to the person involved.', 'Report the issue to management immediately.'),

  -- Stage 6
  ('s6-idioms', 1, 'What does the idiom "beat around the bush" mean?', 'avoid addressing the main topic directly', 'talk loudly in public spaces', 'make a decision without thinking'),
  ('s6-idioms', 2, 'What does "bite the bullet" signify in challenging situations?', 'face a difficult task with courage', 'avoid responsibility for an error', 'complain about a hard decision'),
  ('s6-idioms', 8, 'What is meant by the expression "call it a day"?', 'stop working on something for the rest of the day', 'cancel an upcoming meeting', 'postpone a decision until tomorrow'),
  ('s6-idioms', 9, 'What does the phrase "cost an arm and a leg" imply?', 'be extremely expensive', 'require physical effort', 'cause severe financial loss'),
  ('s6-idioms', 10, 'What does "a piece of cake" refer to?', 'something remarkably easy to accomplish', 'a small reward for good work', 'a pleasant surprise at work'),
  ('s6-academic', 1, 'Which adjective describes something present or existing everywhere?', 'ubiquitous', 'scarce', 'transitory'),
  ('s6-academic', 2, 'Which word is a formal synonym for "mitigate"?', 'alleviate', 'aggravate', 'exacerbate'),
  ('s6-academic', 8, 'What does a "paradigm shift" represent in scientific research?', 'a fundamental change in approach or underlying assumptions', 'a minor adjustment to an existing theory', 'a temporary pause in experimental research'),
  ('s6-academic', 9, 'What is "empirical evidence" based on?', 'direct observation and systematic experimentation', 'theoretical models and abstract reasoning', 'historical consensus and traditional beliefs'),
  ('s6-academic', 10, 'Which word describes information that is superfluous or unnecessary?', 'redundant', 'essential', 'indispensable'),
  ('s6-grammar', 1, 'Which sentence demonstrates correct inversion following a negative adverb?', 'Seldom have I encountered such extraordinary dedication.', 'Seldom I have encountered such extraordinary dedication.', 'Seldom did I encountered such extraordinary dedication.'),
  ('s6-grammar', 2, 'Which sentence correctly employs the subjunctive mood?', 'It is imperative that he submit the revised document today.', 'It is imperative that he submits the revised document today.', 'It is imperative that he submitted the revised document today.'),
  ('s6-grammar', 8, 'Which sentence uses a cleft structure for rhetorical emphasis?', 'It was the chief executive who authorized the merger.', 'The chief executive authorized the merger yesterday.', 'The merger was authorized by the chief executive.'),
  ('s6-grammar', 9, 'Which sentence correctly uses conditional inversion?', 'Had I been informed earlier, I would have intervened.', 'If had I been informed earlier, I would intervene.', 'Had I inform earlier, I would have intervened.'),
  ('s6-grammar', 10, 'Which sentence properly utilizes a participial clause?', 'Having thoroughly evaluated the data, the analyst published the report.', 'Evaluating thoroughly the data, the report was published.', 'Having evaluate the data, she published the report.'),
  ('s6-rhetoric', 1, 'What is the rhetorical technique of using matching grammatical structures?', 'parallelism', 'hyperbole', 'metaphor'),
  ('s6-rhetoric', 2, 'What effect does "litotes" (ironic understatement) typically achieve?', 'emphasizes an affirmative point by negating its opposite', 'exaggerates facts to persuade the audience', 'creates confusion through contradictory terms'),
  ('s6-rhetoric', 8, 'What is an "oxymoron" in literary analysis?', 'a figure of speech combining contradictory terms', 'a sudden shift in narrative perspective', 'an extended metaphor used throughout a speech'),
  ('s6-rhetoric', 9, 'How does an effective speaker utilize "pathos" in persuasion?', 'by appealing directly to the emotions of the audience', 'by presenting logical data and statistical evidence', 'by establishing personal credibility and authority'),
  ('s6-rhetoric', 10, 'What does "juxtaposition" involve in rhetorical design?', 'placing contrasting ideas side by side for effect', 'repeating key phrases at the start of sentences', 'using abstract symbols to represent real events'),
  ('s6-masterclass', 1, 'What defines C2 language mastery according to CEFR standards?', 'effortless, precise, and nuanced expression across all domains', 'ability to understand complex academic texts with a dictionary', 'fluency in casual daily conversation without errors'),
  ('s6-masterclass', 2, 'How does a C2 speaker handle pragmatic nuance in discourse?', 'by adapting register, tone, and style seamlessly to context', 'by using formal academic language in all settings', 'by employing idiomatic expressions in every sentence'),
  ('s6-masterclass', 8, 'What is the hallmark of sophisticated textual coherence?', 'seamless logical progression and refined cohesive devices', 'frequent usage of advanced vocabulary items', 'lengthy paragraphs with complex clause structures'),
  ('s6-masterclass', 9, 'How do advanced speakers demonstrate mastery over tone?', 'by conveying subtle irony, humor, and cultural subtext', 'by speaking rapidly with native-like pronunciation', 'by avoiding ambiguous or figurative expressions'),
  ('s6-masterclass', 10, 'What represents the pinnacle of English linguistic proficiency?', 'complete command over implicit meanings and stylistic variation', 'passing an advanced standardized proficiency exam', 'writing error-free essays on specialized technical topics');

-- ============================================================================
-- 5. NẠP DỮ LIỆU ĐẦY ĐỦ 30 BÀI (WORD ORDER)
-- ============================================================================
INSERT INTO seed_word_order_questions (lesson_code, sort_order, question_text, explanation, correct_answer, word_bank) VALUES
  ('s1-greetings', 3, 'Sắp xếp các từ thành câu hỏi thăm sức khỏe:', 'Sáng nay bạn khỏe không?', 'How are you this morning?', '["How", "are", "you", "this", "morning?"]'),
  ('s1-greetings', 4, 'Sắp xếp các từ thành câu chào gặp lại:', 'Rất vui được gặp lại bạn.', 'It is nice to see you again.', '["It", "is", "nice", "to", "see", "you", "again."]'),
  ('s1-introductions', 3, 'Sắp xếp các từ thành câu giới thiệu tên:', 'Tên tôi là Anna.', 'My name is Anna.', '["My", "name", "is", "Anna."]'),
  ('s1-introductions', 4, 'Sắp xếp các từ thành câu nói về quê quán:', 'Tôi đến từ Việt Nam.', 'I am from Vietnam.', '["I", "am", "from", "Vietnam."]'),
  ('s1-numbers', 3, 'Sắp xếp các từ thành câu chỉ số lượng sách:', 'Tôi có ba quyển sách.', 'I have three books.', '["I", "have", "three", "books."]'),
  ('s1-numbers', 4, 'Sắp xếp các từ thành câu chỉ số lượng học sinh:', 'Có mười học sinh trong lớp.', 'There are ten students in the class.', '["There", "are", "ten", "students", "in", "the", "class."]'),
  ('s1-family', 3, 'Sắp xếp các từ thành câu giới thiệu em gái:', 'Đây là em gái tôi.', 'This is my younger sister.', '["This", "is", "my", "younger", "sister."]'),
  ('s1-family', 4, 'Sắp xếp các từ thành câu nói về nơi ở của bố mẹ:', 'Bố mẹ tôi sống gần đây.', 'My parents live nearby.', '["My", "parents", "live", "nearby."]'),
  ('s1-food', 3, 'Sắp xếp các từ thành câu gọi đồ uống lịch sự:', 'Tôi muốn một ly nước.', 'I would like a glass of water.', '["I", "would", "like", "a", "glass", "of", "water."]'),
  ('s1-food', 4, 'Sắp xếp các từ thành câu miêu tả quả táo:', 'Quả táo này ngọt và tươi.', 'The apple is sweet and fresh.', '["The", "apple", "is", "sweet", "and", "fresh."]'),
  ('s2-food', 3, 'Sắp xếp các từ thành câu gọi đồ uống:', 'Tôi muốn một ly nước.', 'I would like a glass of water.', '["I", "would", "like", "a", "glass", "of", "water."]'),
  ('s2-food', 4, 'Sắp xếp các từ thành câu khen món súp:', 'Món súp này nóng và ngon.', 'The soup is hot and delicious.', '["The", "soup", "is", "hot", "and", "delicious."]'),
  ('s2-shopping', 3, 'Sắp xếp các từ thành câu hỏi giá chiếc áo:', 'Chiếc áo này giá bao nhiêu?', 'How much is this shirt?', '["How", "much", "is", "this", "shirt?"]'),
  ('s2-shopping', 4, 'Sắp xếp các từ thành câu yêu cầu túi mua sắm:', 'Tôi cần một chiếc túi mua sắm nhỏ.', 'I need a small shopping bag.', '["I", "need", "a", "small", "shopping", "bag."]'),
  ('s2-daily-activities', 3, 'Sắp xếp các từ thành câu miêu tả thói quen:', 'Cô ấy thức dậy lúc 6 giờ mỗi sáng.', 'She wakes up at six every morning.', '["She", "wakes", "up", "at", "six", "every", "morning."]'),
  ('s2-daily-activities', 4, 'Sắp xếp các từ thành câu nấu ăn:', 'Chúng tôi cùng nhau nấu bữa tối.', 'We cook dinner together.', '["We", "cook", "dinner", "together."]'),
  ('s2-transportation', 3, 'Sắp xếp các từ thành câu chỉ điểm dừng xe buýt:', 'Xe buýt dừng gần nhà ga.', 'The bus stops near the station.', '["The", "bus", "stops", "near", "the", "station."]'),
  ('s2-transportation', 4, 'Sắp xếp các từ thành câu đi xe đạp:', 'Tôi đi xe đạp đến chỗ làm.', 'I ride my bicycle to work.', '["I", "ride", "my", "bicycle", "to", "work."]'),
  ('s2-hobbies', 3, 'Sắp xếp các từ thành câu thể hiện sở thích:', 'Tôi thích nghe nhạc.', 'I enjoy listening to music.', '["I", "enjoy", "listening", "to", "music."]'),
  ('s2-hobbies', 4, 'Sắp xếp các từ thành câu chơi thể thao:', 'Anh ấy chơi tennis vào cuối tuần.', 'He plays tennis on weekends.', '["He", "plays", "tennis", "on", "weekends."]'),
  ('s3-travel', 3, 'Sắp xếp các từ thành câu hỏi vị trí khách sạn:', 'Khách sạn gần nhất ở đâu?', 'Where is the nearest hotel?', '["Where", "is", "the", "nearest", "hotel?"]'),
  ('s3-travel', 4, 'Sắp xếp các từ thành câu xác nhận đặt phòng:', 'Tôi có đặt phòng cho tối nay.', 'I have a reservation for tonight.', '["I", "have", "a", "reservation", "for", "tonight."]'),
  ('s3-school', 3, 'Sắp xếp các từ thành câu yêu cầu mở sách:', 'Vui lòng mở sách trang số 10.', 'Please open your book to page ten.', '["Please", "open", "your", "book", "to", "page", "ten."]'),
  ('s3-school', 4, 'Sắp xếp các từ thành câu học sinh ở thư viện:', 'Học sinh đang học trong thư viện.', 'The students are studying in the library.', '["The", "students", "are", "studying", "in", "the", "library."]'),
  ('s3-hobbies', 3, 'Sắp xếp các từ thành câu diễn tả sở thích:', 'Tôi thích nghe nhạc.', 'I enjoy listening to music.', '["I", "enjoy", "listening", "to", "music."]'),
  ('s3-hobbies', 4, 'Sắp xếp các từ thành câu chơi thể thao:', 'Anh ấy chơi tennis vào cuối tuần.', 'He plays tennis on weekends.', '["He", "plays", "tennis", "on", "weekends."]'),
  ('s3-job-interview', 3, 'Sắp xếp các từ thành câu trình bày kinh nghiệm:', 'Tôi có 5 năm kinh nghiệm.', 'I have five years of experience.', '["I", "have", "five", "years", "of", "experience."]'),
  ('s3-job-interview', 4, 'Sắp xếp các từ thành câu thể hiện sự quan tâm công việc:', 'Tôi rất quan tâm đến vị trí này.', 'I am interested in this position.', '["I", "am", "interested", "in", "this", "position."]'),
  ('s3-technology', 3, 'Sắp xếp các từ thành câu nói về lợi ích công nghệ:', 'Công nghệ giúp cuộc sống dễ dàng hơn.', 'Technology makes our lives easier.', '["Technology", "makes", "our", "lives", "easier."]'),
  ('s3-technology', 4, 'Sắp xếp các từ thành câu gửi email:', 'Tôi gửi email mỗi ngày.', 'I send emails every single day.', '["I", "send", "emails", "every", "single", "day."]'),
  ('s4-telephone', 3, 'Sắp xếp các từ thành câu nhờ nói chậm lại:', 'Bạn có thể nói chậm hơn được không?', 'Could you speak more slowly, please?', '["Could", "you", "speak", "more", "slowly,", "please?"]'),
  ('s4-telephone', 4, 'Sắp xếp các từ thành câu hứa gọi lại:', 'Tôi sẽ gọi lại cho bạn chiều nay.', 'I will call you back this afternoon.', '["I", "will", "call", "you", "back", "this", "afternoon."]'),
  ('s4-meetings', 3, 'Sắp xếp các từ thành câu bắt đầu cuộc họp:', 'Chúng ta hãy bắt đầu cuộc họp đúng giờ.', 'Let us begin the meeting on time.', '["Let", "us", "begin", "the", "meeting", "on", "time."]'),
  ('s4-meetings', 4, 'Sắp xếp các từ thành câu thể hiện nhất trí:', 'Tôi đồng ý với đề xuất của bạn.', 'I agree with your suggestion.', '["I", "agree", "with", "your", "suggestion."]'),
  ('s4-emails', 3, 'Sắp xếp các từ thành câu thông báo tệp đính kèm:', 'Vui lòng xem báo cáo đính kèm.', 'Please find the report attached.', '["Please", "find", "the", "report", "attached."]'),
  ('s4-emails', 4, 'Sắp xếp các từ thành câu mong nhận phản hồi:', 'Tôi mong nhận được phản hồi của bạn.', 'I look forward to your reply.', '["I", "look", "forward", "to", "your", "reply."]'),
  ('s4-workplace', 3, 'Sắp xếp các từ thành câu nhờ hỗ trợ công việc:', 'Bạn có thể giúp tôi việc này không?', 'Could you help me with this task?', '["Could", "you", "help", "me", "with", "this", "task?"]'),
  ('s4-workplace', 4, 'Sắp xếp các từ thành câu thông báo hạn chót:', 'Hạn chót là thứ Sáu tới.', 'The deadline is next Friday.', '["The", "deadline", "is", "next", "Friday."]'),
  ('s4-negotiation', 3, 'Sắp xếp các từ thành câu thể hiện khả năng đạt thỏa thuận:', 'Chúng ta có thể đạt được thỏa thuận hôm nay.', 'We can reach an agreement today.', '["We", "can", "reach", "an", "agreement", "today."]'),
  ('s4-negotiation', 4, 'Sắp xếp các từ thành câu đưa ra báo giá cuối cùng:', 'Đây là đề nghị cuối cùng của chúng tôi.', 'This is our final offer.', '["This", "is", "our", "final", "offer."]'),
  ('s5-opinions', 3, 'Sắp xếp các từ thành câu tin tưởng vào kế hoạch:', 'Tôi nghĩ kế hoạch này sẽ hiệu quả.', 'I think this plan will work well.', '["I", "think", "this", "plan", "will", "work", "well."]'),
  ('s5-opinions', 4, 'Sắp xếp các từ thành câu khuyên nên chờ đợi:', 'Theo ý kiến tôi, chúng ta nên chờ.', 'In my opinion, we should wait.', '["In", "my", "opinion,", "we", "should", "wait."]'),
  ('s5-storytelling', 3, 'Sắp xếp các từ thành câu diễn tả cảm xúc ban đầu:', 'Lúc đầu, tôi cảm thấy hơi lo lắng.', 'At first, I felt a little nervous.', '["At", "first,", "I", "felt", "a", "little", "nervous."]'),
  ('s5-storytelling', 4, 'Sắp xếp các từ thành câu kể diễn biến:', 'Sau đó chúng tôi tìm được nơi nghỉ yên tĩnh.', 'Then we found a quiet place to rest.', '["Then", "we", "found", "a", "quiet", "place", "to", "rest."]'),
  ('s5-goals', 3, 'Sắp xếp các từ thành câu thể hiện sự quyết tâm:', 'Tôi sẽ luyện tập mỗi ngày.', 'I am going to practice every day.', '["I", "am", "going", "to", "practice", "every", "day."]'),
  ('s5-goals', 4, 'Sắp xếp các từ thành câu phát biểu mục tiêu:', 'Mục tiêu của tôi là nói tiếng Anh tự tin.', 'My goal is to speak confidently.', '["My", "goal", "is", "to", "speak", "confidently."]'),
  ('s5-discussion', 3, 'Sắp xếp các từ thành câu phân tích vấn đề:', 'Vấn đề này đòi hỏi sự phân tích cẩn thận.', 'This issue requires careful analysis.', '["This", "issue", "requires", "careful", "analysis."]'),
  ('s5-discussion', 4, 'Sắp xếp các từ thành câu đánh giá lựa chọn:', 'Cân nhắc cả hai phương án là cần thiết.', 'Weighing both options is necessary.', '["Weighing", "both", "options", "is", "necessary."]'),
  ('s5-review', 3, 'Sắp xếp các từ thành câu hỏi vị trí lịch sự:', 'Bạn có thể chỉ cho tôi nhà ga ở đâu không?', 'Could you tell me where the station is?', '["Could", "you", "tell", "me", "where", "the", "station", "is?"]'),
  ('s5-review', 4, 'Sắp xếp các từ thành câu cảm ơn cuộc trò chuyện:', 'Rất vui được trò chuyện cùng bạn.', 'It was a pleasure talking with you.', '["It", "was", "a", "pleasure", "talking", "with", "you."]'),
  ('s6-idioms', 3, 'Sắp xếp các từ thành câu khuyên không nên vòng vo:', 'Đừng có vòng vo tam quốc với tôi.', 'Do not beat around the bush with me.', '["Do", "not", "beat", "around", "the", "bush", "with", "me."]'),
  ('s6-idioms', 4, 'Sắp xếp các từ thành câu đối mặt với khó khăn:', 'Chúng ta phải cắn răng chịu đựng và hoàn thành.', 'We must bite the bullet and finish.', '["We", "must", "bite", "the", "bullet", "and", "finish."]'),
  ('s6-academic', 3, 'Sắp xếp các từ thành câu nói về sự phổ biến:', 'Công nghệ có mặt khắp nơi trong xã hội hiện đại.', 'Technology is ubiquitous in modern society.', '["Technology", "is", "ubiquitous", "in", "modern", "society."]'),
  ('s6-academic', 4, 'Sắp xếp các từ thành câu về bằng chứng thực nghiệm:', 'Bằng chứng thực nghiệm hỗ trợ giả thuyết này.', 'Empirical evidence supports this scientific hypothesis.', '["Empirical", "evidence", "supports", "this", "scientific", "hypothesis."]'),
  ('s6-grammar', 3, 'Sắp xếp các từ thành câu đảo ngữ nhấn mạnh:', 'Không những cô ấy thắng mà cô ấy còn xuất sắc.', 'Not only did she win, but she also excelled.', '["Not", "only", "did", "she", "win,", "but", "she", "also", "excelled."]'),
  ('s6-grammar', 4, 'Sắp xếp các từ thành câu đảo ngữ thời gian:', 'Chúng tôi vừa đến thì trời bắt đầu mưa.', 'Scarcely had we arrived when the rain started.', '["Scarcely", "had", "we", "arrived", "when", "the", "rain", "started."]'),
  ('s6-rhetoric', 3, 'Sắp xếp các từ thành câu định hình văn phong:', 'Sự thanh lịch và chuẩn xác định hình phong cách văn học.', 'Elegance and precision define his literary style.', '["Elegance", "and", "precision", "define", "his", "literary", "style."]'),
  ('s6-rhetoric', 4, 'Sắp xếp các từ thành câu nói về nghệ thuật im lặng:', 'Sự im lặng đôi khi là sức mạnh hùng biện nhất.', 'Silence is sometimes the most powerful rhetoric.', '["Silence", "is", "sometimes", "the", "most", "powerful", "rhetoric."]'),
  ('s6-masterclass', 3, 'Sắp xếp các từ thành câu nói về sự tinh thông:', 'Sự tinh thông đòi hỏi sự tận tâm và chiều sâu phân tích.', 'Mastery requires dedication and analytical depth.', '["Mastery", "requires", "dedication", "and", "analytical", "depth."]'),
  ('s6-masterclass', 4, 'Sắp xếp các từ thành câu định nghĩa sự hùng biện:', 'Sự hùng biện thực sự vượt lên trên từ vựng đơn thuần.', 'True eloquence transcends mere vocabulary.', '["True", "eloquence", "transcends", "mere", "vocabulary."]');

-- ============================================================================
-- 6. NẠP DỮ LIỆU 30 BÀI LISTENING
-- CEFR: A1 -> A2 -> B1 -> B2 -> C1 -> C2
-- ============================================================================

INSERT INTO seed_listening_questions
  (lesson_code, sort_order, question_text, explanation, correct_answer, word_bank, audio_url) VALUES
('s1-greetings', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chào buổi sáng! Hôm nay bạn thế nào?', 'Good morning! How are you today?', '["Good","morning!","How","are","you","today?","the","it","want"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A1.mp3'),
('s1-introductions', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi đến từ Việt Nam.', 'I come from Vietnam.', '["I","come","from","Vietnam.","we","has","new"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A2.mp3'),
('s1-numbers', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi có ba người bạn trong lớp.', 'I have three friends in my class.', '["I","have","three","friends","in","my","class.","this","need","because"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A3.mp3'),
('s1-family', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chị gái tôi là một giáo viên.', 'My older sister is a teacher.', '["My","older","sister","is","a","teacher.","will","old","how"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A4.mp3'),
('s1-food', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi thích ăn bánh mì vào bữa sáng.', 'I like eating bread for breakfast.', '["I","like","eating","bread","for","breakfast.","good","but","all"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A5.mp3'),
('s2-food', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chúng tôi thường ăn tối cùng nhau vào cuối tuần.', 'We usually have dinner together on weekends.', '["We","usually","have","dinner","together","on","weekends.","very","why","first"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A6.mp3'),
('s2-shopping', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Bạn có thể giảm giá cho tôi một chút không?', 'Could you give me a small discount?', '["Could","you","give","me","a","small","discount?","or","each","week"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A7.mp3'),
('s2-daily-activities', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Anh ấy thường đi bộ đến nơi làm việc.', 'He usually walks to work.', '["He","usually","walks","to","work.","not","last","class"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A8.mp3'),
('s2-transportation', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chuyến tàu tiếp theo sẽ đến trong mười phút nữa.', 'The next train will arrive in ten minutes.', '["The","next","train","will","arrive","in","ten","minutes.","every","year","world"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A9.mp3'),
('s2-hobbies', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi thích chụp ảnh phong cảnh vào kỳ nghỉ.', 'I enjoy taking pictures of landscapes on vacation.', '["I","enjoy","taking","pictures","of","landscapes","on","vacation.","next","teacher","answer"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A10.mp3'),
('s3-travel', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chúng tôi đã đặt phòng khách sạn gần bãi biển.', 'We booked a hotel room near the beach.', '["We","booked","a","hotel","room","near","the","beach.","people","way","train"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A11.mp3'),
('s3-school', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Giáo viên yêu cầu chúng tôi hoàn thành bài tập trước thứ Sáu.', 'The teacher asked us to finish the assignment before Friday.', '["The","teacher","asked","us","to","finish","the","assignment","before","Friday.","student","book","sentence"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A12.mp3'),
('s3-hobbies', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi bắt đầu học chơi guitar khi còn học trung học.', 'I started learning to play the guitar in high school.', '["I","started","learning","to","play","the","guitar","in","high","school.","part","plane","there"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A13.mp3'),
('s3-job-interview', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi đã phát triển kỹ năng giao tiếp thông qua công việc trước đây.', 'I developed my communication skills through my previous job.', '["I","developed","my","communication","skills","through","my","previous","job.","water","language","during"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A14.mp3'),
('s3-technology', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Các ứng dụng di động giúp mọi người quản lý thời gian hiệu quả hơn.', 'Mobile applications help people manage their time more efficiently.', '["Mobile","applications","help","people","manage","their","time","more","efficiently.","house","about","behind"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A15.mp3'),
('s4-telephone', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi sẽ gọi lại cho bạn ngay khi cuộc họp kết thúc.', 'I will call you back as soon as the meeting ends.', '["I","will","call","you","back","as","soon","as","the","meeting","ends.","today","since","low"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A16.mp3'),
('s4-meetings', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chúng ta nên xem xét các lựa chọn trước khi đưa ra quyết định cuối cùng.', 'We should consider the options before making a final decision.', '["We","should","consider","the","options","before","making","a","final","decision.","into","above","different"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A17.mp3'),
('s4-emails', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Vui lòng xác nhận rằng bạn đã nhận được tài liệu được gửi kèm.', 'Please confirm that you have received the attached documents.', '["Please","confirm","that","you","have","received","the","attached","documents.","until","fast","free"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A18.mp3'),
('s4-workplace', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Việc phân chia trách nhiệm rõ ràng có thể cải thiện hiệu suất của nhóm.', 'Clearly dividing responsibilities can improve team performance.', '["Clearly","dividing","responsibilities","can","improve","team","performance.","near","same","thing"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A19.mp3'),
('s4-negotiation', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Chúng tôi sẵn sàng xem xét một đề xuất có lợi cho cả hai bên.', 'We are willing to consider a proposal that benefits both parties.', '["We","are","willing","to","consider","a","proposal","that","benefits","both","parties.","slow","sure","in"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A20.mp3'),
('s5-opinions', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Theo quan điểm của tôi, việc đầu tư vào giáo dục là điều cần thiết để thúc đẩy sự phát triển bền vững.', 'In my view, investing in education is essential for promoting sustainable development.', '["In","my","view,","investing","in","education","is","essential","for","promoting","sustainable","development.","better","place","she"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A21.mp3'),
('s5-storytelling', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Mặc dù ban đầu gặp phải nhiều trở ngại, cô ấy vẫn kiên trì theo đuổi mục tiêu của mình.', 'Despite encountering numerous obstacles initially, she remained committed to pursuing her goals.', '["Despite","encountering","numerous","obstacles","initially,","she","remained","committed","to","pursuing","her","goals.","clear","is","from"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A22.mp3'),
('s5-goals', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Để đạt được thành công lâu dài, chúng ta cần liên tục đánh giá và điều chỉnh chiến lược của mình.', 'To achieve long-term success, we need to continuously evaluate and adjust our strategies.', '["To","achieve","long-term","success,","we","need","to","continuously","evaluate","and","adjust","our","strategies.","person","they","like"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A23.mp3'),
('s5-discussion', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Cuộc tranh luận đã làm nổi bật sự phức tạp của vấn đề và sự cần thiết phải xem xét nhiều góc nhìn khác nhau.', 'The debate highlighted the complexity of the issue and the need to consider multiple perspectives.', '["The","debate","highlighted","the","complexity","of","the","issue","and","the","need","to","consider","multiple","perspectives.","are","have","big"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A24.mp3'),
('s5-review', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Tôi thực sự đánh giá cao cơ hội được trao đổi những ý tưởng sâu sắc với các đồng nghiệp giàu kinh nghiệm.', 'I genuinely appreciate the opportunity to exchange insightful ideas with experienced colleagues.', '["I","genuinely","appreciate","the","opportunity","to","exchange","insightful","ideas","with","experienced","colleagues.","it","want","again"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A25.mp3'),
('s6-idioms', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Đừng vội kết luận khi chưa xem xét tất cả các bằng chứng.', 'Do not jump to conclusions before examining all the evidence.', '["Do","not","jump","to","conclusions","before","examining","all","the","evidence.","has","new","where"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A26.mp3'),
('s6-academic', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Sự giao thoa giữa các ngành học khác nhau thường dẫn đến những khám phá mang tính đột phá.', 'The intersection of disparate disciplines often gives rise to groundbreaking discoveries.', '["The","intersection","of","disparate","disciplines","often","gives","rise","to","groundbreaking","discoveries.","need","because","most"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A27.mp3'),
('s6-grammar', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Hiếm khi một quyết định có ảnh hưởng sâu rộng như vậy lại được đưa ra mà không có sự cân nhắc kỹ lưỡng.', 'Rarely has a decision of such far-reaching consequences been made without careful deliberation.', '["Rarely","has","a","decision","of","such","far-reaching","consequences","been","made","without","careful","deliberation.","old","how","three"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A28.mp3'),
('s6-rhetoric', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Không phải sự phong phú của ngôn từ, mà chính sự chính xác trong cách diễn đạt mới làm nên sức mạnh của lập luận.', 'It is not the abundance of words, but the precision of expression that lends an argument its strength.', '["It","is","not","the","abundance","of","words,","but","the","precision","of","expression","that","lends","an","argument","its","strength.","all","night","city"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A29.mp3'),
('s6-masterclass', 5, 'Nghe và sắp xếp các từ thành câu đúng:', 'Sự xuất sắc thực sự đòi hỏi khả năng tổng hợp kiến thức, tư duy phản biện và sự kiên trì không ngừng nghỉ.', 'True excellence demands the synthesis of knowledge, critical thinking, and unwavering perseverance.', '["True","excellence","demands","the","synthesis","of","knowledge,","critical","thinking,","and","unwavering","perseverance.","why","first","school"]', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/listening/A30.mp3');

-- ============================================================================
-- 7. NẠP DỮ LIỆU ĐẦY ĐỦ 30 BÀI (FILL CHOICE)
-- ============================================================================
INSERT INTO seed_fill_choice_questions (lesson_code, sort_order, question_text, explanation, correct_answer, distractor_one, distractor_two) VALUES
  ('s1-greetings', 6, 'How ___ you today?', 'Chủ ngữ "you" đi với động từ to be "are".', 'are', 'is', 'am'),
  ('s1-introductions', 6, 'My name ___ John.', 'Danh từ số ít đi với động từ to be "is".', 'is', 'are', 'am'),
  ('s1-numbers', 6, 'Three plus four is ___.', '3 + 4 = 7 (seven).', 'seven', 'six', 'eight'),
  ('s1-family', 6, 'I have a brother and a ___.', 'Cặp từ chỉ anh em / chị em đi với sister.', 'sister', 'mother', 'uncle'),
  ('s1-food', 6, 'She drinks ___ every morning.', 'Chọn đồ uống phù hợp cho buổi sáng.', 'coffee', 'bread', 'rice'),
  ('s2-food', 6, 'She ___ coffee every morning.', 'Chủ ngữ số ít ngôi thứ 3 ở hiện tại đơn thêm "s".', 'drinks', 'drink', 'drinking'),
  ('s2-shopping', 6, 'How ___ is this shirt?', 'Hỏi giá tiền của danh từ không đếm được dùng "much".', 'much', 'many', 'long'),
  ('s2-daily-activities', 6, 'He ___ to school at seven every day.', 'Chủ ngữ "He" chia động từ "goes".', 'goes', 'go', 'going'),
  ('s2-transportation', 6, 'We travel to work ___ bus.', 'Phương tiện giao thông đi kèm giới từ "by".', 'by', 'at', 'on'),
  ('s2-hobbies', 6, 'She enjoys ___ books in the evening.', 'Động từ "enjoy" đi kèm dạng V-ing.', 'reading', 'read', 'reads'),
  ('s3-travel', 6, 'You need a ___ to enter another country.', 'Điền danh từ "passport" (hộ chiếu).', 'passport', 'ticket', 'license'),
  ('s3-school', 6, 'The students are studying ___ the library.', 'Địa điểm không gian kín dùng giới từ "in".', 'in', 'on', 'at'),
  ('s3-hobbies', 6, 'She enjoys ___ books in the evening.', 'Động từ "enjoy" đi kèm V-ing.', 'reading', 'read', 'reads'),
  ('s3-job-interview', 6, 'I have five years of work ___.', 'Kinh nghiệm làm việc dùng danh từ "experience".', 'experience', 'experiment', 'exercise'),
  ('s3-technology', 6, 'Please connect ___ the Wi-Fi network.', 'Cụm động từ "connect to".', 'to', 'at', 'with'),
  ('s4-telephone', 6, 'The line is bad. Could you speak ___, please?', 'Trạng từ bổ nghĩa cho động từ "speak" dùng "loudly".', 'loudly', 'loud', 'loudness'),
  ('s4-meetings', 6, 'Please listen ___ the instructions carefully.', 'Cụm động từ "listen to".', 'to', 'at', 'for'),
  ('s4-emails', 6, 'I sent the report as an ___.', 'Danh từ tệp đính kèm trong email dùng "attachment".', 'attachment', 'attach', 'attaching'),
  ('s4-workplace', 6, 'My workday ___ at 5 PM.', 'Chủ ngữ số ít hiện tại đơn chia "ends".', 'ends', 'end', 'ending'),
  ('s4-negotiation', 6, 'We are looking forward ___ working with you.', 'Cụm từ "look forward to + V-ing".', 'to', 'for', 'at'),
  ('s5-opinions', 6, 'In my ___, we should proceed with caution.', 'Danh từ "opinion" trong cụm "In my opinion".', 'opinion', 'view', 'thought'),
  ('s5-storytelling', 6, '___, I felt somewhat hesitant before the speech.', 'Cụm từ "At first".', 'At first', 'At last', 'At least'),
  ('s5-goals', 6, 'I am going ___ practice every single day.', 'Cấu trúc "be going to + V".', 'to', 'for', 'at'),
  ('s5-discussion', 6, 'We must focus ___ the primary objective.', 'Cụm động từ "focus on".', 'on', 'at', 'in'),
  ('s5-review', 6, 'Thank you ___ your continued support.', 'Cụm từ "thank you for".', 'for', 'to', 'about'),
  ('s6-idioms', 6, 'Let us not beat ___ the bush.', 'Thành ngữ "beat around the bush".', 'around', 'through', 'under'),
  ('s6-academic', 6, 'Smartphones are now ___ in modern daily life.', 'Tính từ "ubiquitous" (phổ biến khắp nơi).', 'ubiquitous', 'scarce', 'transient'),
  ('s6-grammar', 6, 'Seldom ___ such remarkable dedication.', 'Cấu trúc đảo ngữ trợ động từ "have I seen".', 'have I seen', 'I have seen', 'seen I have'),
  ('s6-rhetoric', 6, 'His entire argument relied heavily ___ emotional appeal.', 'Cụm động từ "rely on".', 'on', 'at', 'with'),
  ('s6-masterclass', 6, 'True fluency demands complete ___ over grammar.', 'Danh từ "command" (sự làm chủ).', 'command', 'control', 'mastery');

-- ============================================================================
-- 8. NẠP DỮ LIỆU ĐẦY ĐỦ 30 BÀI (LISTEN CHOICE)
-- ============================================================================
INSERT INTO seed_listen_choice_questions (lesson_code, sort_order, question_text, explanation, audio_url, correct_answer, distractor_one, distractor_two, distractor_three) VALUES
  ('s1-greetings', 7, 'Hello, how ___ you?', 'Câu trong audio: "Hello, how are you?" — "you" đi với "are".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/1.mp3', 'are', 'is', 'all', 'own'),
  ('s1-introductions', 7, 'My ___ is Lina.', 'Câu trong audio: "My name is Lina." — từ còn thiếu là "name".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/2.mp3', 'name', 'age', 'home', 'job'),
  ('s1-numbers', 7, 'I would like a cup of ___.', 'Câu trong audio: "I would like a cup of tea." — đồ uống được nhắc đến là "tea".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/3.mp3', 'tea', 'coffee', 'water', 'soup'),
  ('s1-family', 7, 'Hello, ___ are you?', 'Câu trong audio: "Hello, how are you?" — từ để hỏi là "how".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/4.mp3', 'how', 'what', 'who', 'when'),
  ('s1-food', 7, 'I would like a ___ of tea.', 'Câu trong audio: "I would like a cup of tea." — danh từ chỉ lượng là "cup".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/5.mp3', 'cup', 'glass', 'box', 'piece'),
  ('s2-food', 7, 'I would ___ a cup of tea.', 'Câu trong audio: "I would like a cup of tea." — động từ là "like".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/6.mp3', 'like', 'drink', 'buy', 'bring'),
  ('s2-shopping', 7, 'How ___ does this cost?', 'Câu trong audio: "How much does this cost?" — hỏi giá dùng "much".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/7.mp3', 'much', 'many', 'long', 'often'),
  ('s2-daily-activities', 7, 'She ___ up at six every morning.', 'Câu trong audio: "She wakes up at six every morning." — động từ là "wakes".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/8.mp3', 'wakes', 'gets', 'puts', 'stands'),
  ('s2-transportation', 7, 'The bus stops near the ___.', 'Câu trong audio: "The bus stops near the station." — địa điểm là "station".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/9.mp3', 'station', 'airport', 'bridge', 'garden'),
  ('s2-hobbies', 7, 'I enjoy ___ to music.', 'Câu trong audio: "I enjoy listening to music." — động từ là "listening".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/10.mp3', 'listening', 'talking', 'dancing', 'writing'),
  ('s3-travel', 7, 'Where is the ___ hotel?', 'Câu trong audio: "Where is the nearest hotel?" — tính từ là "nearest".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/11.mp3', 'nearest', 'biggest', 'oldest', 'cheapest'),
  ('s3-school', 7, 'The students are studying in the ___.', 'Câu trong audio: "The students are studying in the library." — địa điểm là "library".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/12.mp3', 'library', 'kitchen', 'garden', 'pool'),
  ('s3-hobbies', 7, 'I enjoy listening to ___.', 'Câu trong audio: "I enjoy listening to music." — danh từ là "music".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/13.mp3', 'music', 'news', 'noise', 'speech'),
  ('s3-job-interview', 7, 'I have five years of ___.', 'Câu trong audio: "I have five years of experience." — danh từ là "experience".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/14.mp3', 'experience', 'education', 'practice', 'patience'),
  ('s3-technology', 7, 'Technology makes our lives ___.', 'Câu trong audio: "Technology makes our lives easier." — tính từ so sánh là "easier".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/15.mp3', 'easier', 'shorter', 'slower', 'richer'),
  ('s4-telephone', 7, 'Could you speak more ___, please?', 'Câu trong audio: "Could you speak more slowly, please?" — trạng từ là "slowly".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/16.mp3', 'slowly', 'loudly', 'kindly', 'quickly'),
  ('s4-meetings', 7, 'Let us begin the ___ on time.', 'Câu trong audio: "Let us begin the meeting on time." — danh từ là "meeting".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/17.mp3', 'meeting', 'dinner', 'lesson', 'party'),
  ('s4-emails', 7, 'Please find the ___ attached.', 'Câu trong audio: "Please find the report attached." — danh từ là "report".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/18.mp3', 'report', 'invoice', 'photo', 'letter'),
  ('s4-workplace', 7, 'Could you help me with this ___?', 'Câu trong audio: "Could you help me with this task?" — danh từ là "task".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/19.mp3', 'task', 'project', 'problem', 'errand'),
  ('s4-negotiation', 7, 'We can reach an ___ today.', 'Câu trong audio: "We can reach an agreement today." — danh từ là "agreement".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/20.mp3', 'agreement', 'argument', 'example', 'appointment'),
  ('s5-opinions', 7, 'I think this ___ will work well.', 'Câu trong audio: "I think this plan will work well." — danh từ là "plan".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/21.mp3', 'plan', 'idea', 'rule', 'deal'),
  ('s5-storytelling', 7, 'At first, I felt a little ___.', 'Câu trong audio: "At first, I felt a little nervous." — tính từ là "nervous".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/22.mp3', 'nervous', 'bored', 'angry', 'hungry'),
  ('s5-goals', 7, 'I am going to ___ every day.', 'Câu trong audio: "I am going to practice every day." — động từ là "practice".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/23.mp3', 'practice', 'rest', 'sleep', 'travel'),
  ('s5-discussion', 7, 'This issue requires careful ___.', 'Câu trong audio: "This issue requires careful analysis." — danh từ là "analysis".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/24.mp3', 'analysis', 'attention', 'distance', 'permission'),
  ('s5-review', 7, 'It was a ___ talking with you.', 'Câu trong audio: "It was a pleasure talking with you." — danh từ là "pleasure".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/25.mp3', 'pleasure', 'shame', 'problem', 'mistake'),
  ('s6-idioms', 7, 'Do not beat around the ___ with me.', 'Câu trong audio: "Do not beat around the bush with me." — thành ngữ cần từ "bush".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/26.mp3', 'bush', 'tree', 'corner', 'table'),
  ('s6-academic', 7, 'Technology is ___ in modern society.', 'Câu trong audio: "Technology is ubiquitous in modern society." — tính từ là "ubiquitous".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/27.mp3', 'ubiquitous', 'invisible', 'temporary', 'local'),
  ('s6-grammar', 7, 'Not only did she win, but she also ___.', 'Câu trong audio: "Not only did she win, but she also excelled." — động từ là "excelled".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/28.mp3', 'excelled', 'failed', 'arrived', 'agreed'),
  ('s6-rhetoric', 7, 'Elegance and ___ define his literary style.', 'Câu trong audio: "Elegance and precision define his literary style." — danh từ là "precision".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/29.mp3', 'precision', 'patience', 'presence', 'purpose'),
  ('s6-masterclass', 7, 'Mastery requires ___ and analytical depth.', 'Câu trong audio: "Mastery requires dedication and analytical depth." — danh từ là "dedication".', 'https://nvipkuzzxmoquhfpuedg.supabase.co/storage/v1/object/public/english-media/30.mp3', 'dedication', 'determination', 'patience', 'funding');

-- ============================================================================
-- 9. ĐỒNG BỘ DỮ LIỆU TỪ BẢNG TẠM VÀO BẢNG CHÍNH (AN TOÀN 100%)
-- ============================================================================

-- Multiple Choice
INSERT INTO questions (lesson_id, question_text, question_type, explanation, difficulty, sort_order) 
SELECT l.id, seed.question_text, 'multiple_choice', seed.explanation, 'beginner', seed.sort_order 
FROM seed_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code;

-- Word Order
INSERT INTO questions (lesson_id, question_text, question_type, explanation, word_bank, difficulty, sort_order) 
SELECT l.id, seed.question_text, 'word_order', seed.explanation, seed.word_bank, 'beginner', seed.sort_order 
FROM seed_word_order_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code;

-- Listening
INSERT INTO questions (lesson_id, question_text, question_type, explanation, audio_url, word_bank, difficulty, sort_order) 
SELECT l.id, seed.question_text, 'listening', seed.explanation, seed.audio_url, seed.word_bank, 'beginner', seed.sort_order 
FROM seed_listening_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code;

-- Fill Choice
INSERT INTO questions (lesson_id, question_text, question_type, explanation, difficulty, sort_order) 
SELECT l.id, seed.question_text, 'fill_choice', seed.explanation, 'beginner', seed.sort_order 
FROM seed_fill_choice_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code;

-- Listen Choice
INSERT INTO questions (lesson_id, question_text, question_type, explanation, audio_url, difficulty, sort_order) 
SELECT l.id, seed.question_text, 'listen_choice', seed.explanation, seed.audio_url, 'beginner', seed.sort_order 
FROM seed_listen_choice_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code;

-- Answers cho Multiple Choice
INSERT INTO answers (question_id, answer_text, is_correct, sort_order) 
SELECT q.id, CASE slot.n WHEN 1 THEN seed.correct_answer WHEN 2 THEN seed.distractor_one ELSE seed.distractor_two END, slot.n = 1, slot.n 
FROM seed_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code 
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order 
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) AS slot;

-- Answers cho Word Order
INSERT INTO answers (question_id, answer_text, is_correct, sort_order) 
SELECT q.id, seed.correct_answer, TRUE, 1 
FROM seed_word_order_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code 
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order;

-- Answers cho Listening
INSERT INTO answers (question_id, answer_text, is_correct, sort_order) 
SELECT q.id, seed.correct_answer, TRUE, 1 
FROM seed_listening_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code 
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order;

-- Answers cho Fill Choice
INSERT INTO answers (question_id, answer_text, is_correct, sort_order) 
SELECT q.id, CASE slot.n WHEN 1 THEN seed.correct_answer WHEN 2 THEN seed.distractor_one ELSE seed.distractor_two END, slot.n = 1, slot.n 
FROM seed_fill_choice_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code 
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order 
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) AS slot;

-- Answers cho Listen Choice (4 phương án, đúng nhất là correct_answer)
INSERT INTO answers (question_id, answer_text, is_correct, sort_order) 
SELECT q.id, CASE slot.n WHEN 1 THEN seed.correct_answer WHEN 2 THEN seed.distractor_one WHEN 3 THEN seed.distractor_two ELSE seed.distractor_three END, slot.n = 1, slot.n 
FROM seed_listen_choice_questions AS seed JOIN lessons AS l ON l.code = seed.lesson_code 
JOIN questions AS q ON q.lesson_id = l.id AND q.sort_order = seed.sort_order 
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) AS slot;

-- ============================================================================
-- 10. NẠP DỮ LIỆU BATTLE QUESTIONS (ĐẤU TRƯỜNG TỪ VỰNG NHANH)
-- ============================================================================
INSERT INTO battle_questions (prompt_vi, answer_en, sort_order) VALUES
  ('mèo', 'cat', 1), ('chó', 'dog', 2), ('táo', 'apple', 3), ('sách', 'book', 4),
  ('nước', 'water', 5), ('nhà', 'house', 6), ('trường', 'school', 7), ('bạn', 'friend', 8),
  ('vui', 'happy', 9), ('nhanh', 'fast', 10), ('đẹp', 'beautiful', 11), ('ăn', 'eat', 12),
  ('uống', 'drink', 13), ('chạy', 'run', 14), ('đọc', 'read', 15), ('viết', 'write', 16),
  ('lớn', 'big', 17), ('nhỏ', 'small', 18), ('lạnh', 'cold', 19), ('nóng', 'hot', 20);

-- ============================================================================
-- 11. DỌN DẸP BẢNG TẠM & HOÀN TẤT
-- ============================================================================
DROP TEMPORARY TABLE IF EXISTS seed_questions;
DROP TEMPORARY TABLE IF EXISTS seed_word_order_questions;
DROP TEMPORARY TABLE IF EXISTS seed_listening_questions;
DROP TEMPORARY TABLE IF EXISTS seed_fill_choice_questions;
DROP TEMPORARY TABLE IF EXISTS seed_listen_choice_questions;

COMMIT;