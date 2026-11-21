-- ---------------------------------------------------------------------------
-- 2026-11-20: learning analytics + spaced repetition
--
-- 1. `learning_answer_attempts.response_time_ms` — how long a learner took on a
--    question. Without it the app can count mistakes but cannot tell a slow,
--    struggling answer from a careless tap.
-- 2. `match_answers.word_id` — Word Battle rows only kept the typed text, so a
--    missed word could never be tied back to `battle_words`. The vocabulary
--    report needs that link.
-- 3. `review_items` — the spaced-repetition queue. One row per learner and
--    item (a battle word or a lesson question) with its SM-2 lite state.
--
-- Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-learning-analytics.sql
-- ---------------------------------------------------------------------------

ALTER TABLE `learning_answer_attempts`
  ADD COLUMN `response_time_ms` int(10) unsigned DEFAULT NULL AFTER `is_correct`;

ALTER TABLE `match_answers`
  ADD COLUMN `word_id` bigint(20) unsigned DEFAULT NULL AFTER `question_id`,
  ADD KEY `idx_match_answers_word` (`word_id`),
  ADD CONSTRAINT `fk_match_answers_word` FOREIGN KEY (`word_id`) REFERENCES `battle_words` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS `review_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `kind` enum('word','question') NOT NULL,
  `ref_id` bigint(20) unsigned NOT NULL,
  `source` enum('mistake','battle','saved','manual') NOT NULL DEFAULT 'mistake',
  `ease` decimal(4,2) NOT NULL DEFAULT 2.50,
  `interval_days` int(10) unsigned NOT NULL DEFAULT 0,
  `repetitions` int(10) unsigned NOT NULL DEFAULT 0,
  `lapses` int(10) unsigned NOT NULL DEFAULT 0,
  `mistake_count` int(10) unsigned NOT NULL DEFAULT 1,
  `due_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_reviewed_at` datetime DEFAULT NULL,
  `last_grade` enum('again','hard','good','easy') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_items_user_ref` (`user_id`,`kind`,`ref_id`),
  KEY `idx_review_items_due` (`user_id`,`due_at`),
  CONSTRAINT `fk_review_items_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
