-- Engorace database bootstrap: schema only. Generated from the current migrated database.
-- Import with: mysql -u <user> -p < backend/database/init.sql
CREATE DATABASE IF NOT EXISTS `english_learning` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `english_learning`;

-- Module: Reference and configuration
-- badges
CREATE TABLE `badges` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_badges_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- battle_questions
CREATE TABLE `battle_questions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `prompt_vi` varchar(500) NOT NULL,
  `answer_en` varchar(500) NOT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_battle_questions_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- battle_words
CREATE TABLE `battle_words` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `word_en` varchar(64) NOT NULL,
  `translation_vi` varchar(160) NOT NULL,
  `part_of_speech` enum('noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection') NOT NULL,
  `cefr_level` enum('A1','A2','B1','B2','C1','C2') NOT NULL,
  `explanation_vi` varchar(500) NOT NULL,
  `example_en` varchar(300) NOT NULL,
  `example_vi` varchar(300) NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `sort_order` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_battle_words_word` (`word_en`),
  UNIQUE KEY `uq_battle_words_sort_order` (`sort_order`),
  KEY `idx_battle_words_cefr` (`cefr_level`)
) ENGINE=InnoDB AUTO_INCREMENT=170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- quests
CREATE TABLE `quests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(60) NOT NULL,
  `kind` enum('daily','weekly') NOT NULL,
  `title` varchar(140) NOT NULL,
  `description` varchar(400) NOT NULL,
  `metric` enum('lesson','video','duel_win','answers','saved_word','login') NOT NULL,
  `target` int(10) unsigned NOT NULL,
  `rc_reward` int(10) unsigned NOT NULL,
  `xp_reward` int(10) unsigned NOT NULL,
  `rp_reward` int(10) unsigned NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quests_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seasons
CREATE TABLE `seasons` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `status` enum('active','closed','paid') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_seasons_code` (`code`),
  KEY `idx_seasons_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- shop_items
CREATE TABLE `shop_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(60) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(500) NOT NULL,
  `slot` enum('car','frame','nameplate','booster') NOT NULL,
  `rarity` enum('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
  `price` int(10) unsigned NOT NULL DEFAULT 0,
  `unlock_type` enum('default','level','stage','league','achievement') NOT NULL DEFAULT 'default',
  `unlock_value` varchar(60) DEFAULT NULL,
  `visual_key` varchar(60) NOT NULL,
  `style_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`style_json`)),
  `booster_kind` enum('streak_shield','xp_multiplier','rc_multiplier') DEFAULT NULL,
  `booster_charges` int(10) unsigned NOT NULL DEFAULT 0,
  `booster_duration_minutes` int(10) unsigned NOT NULL DEFAULT 0,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shop_items_code` (`code`),
  KEY `idx_shop_items_slot` (`slot`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=258 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- stages
CREATE TABLE `stages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `title` varchar(120) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `theme_key` varchar(40) NOT NULL DEFAULT 'forest',
  `accent_color` char(7) NOT NULL DEFAULT '#00ABDC',
  `sort_order` tinyint(3) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stages_code` (`code`),
  UNIQUE KEY `uq_stages_sort_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Accounts
-- pending_registrations
CREATE TABLE `pending_registrations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(254) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `send_count` smallint(5) unsigned NOT NULL DEFAULT 1,
  `last_sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pending_registrations_email` (`email`),
  KEY `idx_pending_registrations_expires` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(254) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `avatar_public_id` varchar(255) DEFAULT NULL,
  `xp` int(10) unsigned NOT NULL DEFAULT 0,
  `coins` int(10) unsigned NOT NULL DEFAULT 0,
  `streak` smallint(5) unsigned NOT NULL DEFAULT 0,
  `streak_lost` smallint(5) unsigned NOT NULL DEFAULT 0,
  `streak_lost_at` date DEFAULT NULL,
  `last_activity_date` date DEFAULT NULL,
  `role` enum('learner','admin') NOT NULL DEFAULT 'learner',
  `password_set` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `league_tier` enum('coal','copper','iron','gold','redstone','lapis','diamond') NOT NULL DEFAULT 'coal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_providers
CREATE TABLE `user_providers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `provider` enum('google','facebook') NOT NULL,
  `provider_user_id` varchar(191) NOT NULL,
  `email` varchar(254) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `linked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_providers_identity` (`provider`,`provider_user_id`),
  UNIQUE KEY `uq_user_providers_user_provider` (`user_id`,`provider`),
  KEY `idx_user_providers_email` (`email`),
  CONSTRAINT `fk_user_providers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=517 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Learning and review
-- lessons
CREATE TABLE `lessons` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stage_id` bigint(20) unsigned NOT NULL,
  `code` varchar(80) NOT NULL,
  `title` varchar(120) NOT NULL,
  `topic` varchar(120) NOT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lessons_code` (`code`),
  UNIQUE KEY `uq_lessons_stage_order` (`stage_id`,`sort_order`),
  KEY `idx_lessons_stage` (`stage_id`),
  CONSTRAINT `fk_lessons_stage` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=175 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- review_items
CREATE TABLE `review_items` (
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
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- progress
CREATE TABLE `progress` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `lesson_id` bigint(20) unsigned NOT NULL,
  `status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'in_progress',
  `score` decimal(5,2) DEFAULT NULL,
  `practice_seconds` int(11) DEFAULT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `started_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_progress_user_lesson` (`user_id`,`lesson_id`),
  KEY `idx_progress_lesson` (`lesson_id`),
  KEY `idx_progress_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_progress_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2229 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- questions
CREATE TABLE `questions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lesson_id` bigint(20) unsigned NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(40) NOT NULL DEFAULT 'multiple_choice',
  `explanation` text DEFAULT NULL,
  `audio_url` varchar(2048) DEFAULT NULL,
  `word_bank` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`word_bank`)),
  `difficulty` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `sort_order` tinyint(3) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_questions_lesson_order` (`lesson_id`,`sort_order`),
  KEY `idx_questions_lesson` (`lesson_id`),
  CONSTRAINT `fk_questions_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=609 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- answers
CREATE TABLE `answers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `question_id` bigint(20) unsigned NOT NULL,
  `answer_text` varchar(500) NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_answers_question_text` (`question_id`,`answer_text`),
  UNIQUE KEY `uq_answers_question_order` (`question_id`,`sort_order`),
  KEY `idx_answers_question_correct` (`question_id`,`is_correct`),
  CONSTRAINT `fk_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1309 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- learning_answer_attempts
CREATE TABLE `learning_answer_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `question_id` bigint(20) unsigned NOT NULL,
  `submitted_answer` text NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0,
  `response_time_ms` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_learning_attempt_user_correct_date` (`user_id`,`is_correct`,`created_at`),
  KEY `idx_learning_attempt_question` (`question_id`),
  CONSTRAINT `fk_learning_attempt_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_learning_attempt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1902 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Video library
-- video_lessons
CREATE TABLE `video_lessons` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `topic` varchar(100) NOT NULL,
  `cefr_level` enum('A1','A2','B1','B2','C1','C2') NOT NULL,
  `provider` enum('youtube','file') NOT NULL DEFAULT 'youtube',
  `video_url` varchar(500) NOT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `duration_seconds` smallint(5) unsigned NOT NULL DEFAULT 0,
  `xp_reward` smallint(5) unsigned NOT NULL DEFAULT 20,
  `sort_order` smallint(5) unsigned NOT NULL,
  `owner_user_id` bigint(20) unsigned DEFAULT NULL,
  `subtitle_en` varchar(500) DEFAULT NULL,
  `subtitle_vi` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_video_lessons_code` (`code`),
  KEY `idx_video_lessons_owner` (`owner_user_id`,`created_at`),
  KEY `idx_video_lessons_sort` (`sort_order`),
  CONSTRAINT `fk_video_lessons_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- saved_words
CREATE TABLE `saved_words` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `video_id` bigint(20) unsigned DEFAULT NULL,
  `word` varchar(80) NOT NULL,
  `ipa` varchar(80) DEFAULT NULL,
  `meaning_vi` varchar(160) DEFAULT NULL,
  `detail_vi` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_words_user_word` (`user_id`,`word`),
  KEY `idx_saved_words_user` (`user_id`,`created_at`),
  KEY `fk_saved_words_video` (`video_id`),
  CONSTRAINT `fk_saved_words_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_saved_words_video` FOREIGN KEY (`video_id`) REFERENCES `video_lessons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- video_progress
CREATE TABLE `video_progress` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `video_id` bigint(20) unsigned NOT NULL,
  `watched_seconds` smallint(5) unsigned NOT NULL DEFAULT 0,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_video_progress_user_video` (`user_id`,`video_id`),
  KEY `idx_video_progress_user` (`user_id`,`completed`),
  KEY `fk_video_progress_video` (`video_id`),
  CONSTRAINT `fk_video_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_video_progress_video` FOREIGN KEY (`video_id`) REFERENCES `video_lessons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- video_segments
CREATE TABLE `video_segments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `video_id` bigint(20) unsigned NOT NULL,
  `start_ms` int(10) unsigned NOT NULL,
  `end_ms` int(10) unsigned NOT NULL,
  `text_en` text NOT NULL,
  `text_vi` text DEFAULT NULL,
  `sort_order` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_video_segments_video` (`video_id`,`sort_order`),
  CONSTRAINT `fk_video_segments_video` FOREIGN KEY (`video_id`) REFERENCES `video_lessons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1647 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- video_vocabulary
CREATE TABLE `video_vocabulary` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `video_id` bigint(20) unsigned NOT NULL,
  `word` varchar(80) NOT NULL,
  `ipa` varchar(80) NOT NULL,
  `meaning_vi` varchar(160) NOT NULL,
  `detail_vi` varchar(500) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_video_vocabulary_word` (`video_id`,`word`),
  KEY `idx_video_vocabulary_video` (`video_id`,`sort_order`),
  CONSTRAINT `fk_video_vocabulary_video` FOREIGN KEY (`video_id`) REFERENCES `video_lessons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=232 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Arena
-- matches
CREATE TABLE `matches` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `player_one_id` bigint(20) unsigned NOT NULL,
  `player_two_id` bigint(20) unsigned NOT NULL,
  `stage_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('pending','active','completed','cancelled') NOT NULL DEFAULT 'pending',
  `winner_user_id` bigint(20) unsigned DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_matches_player_one` (`player_one_id`,`created_at`),
  KEY `idx_matches_player_two` (`player_two_id`,`created_at`),
  KEY `idx_matches_status` (`status`,`created_at`),
  KEY `idx_matches_stage` (`stage_id`),
  KEY `idx_matches_winner` (`winner_user_id`),
  CONSTRAINT `fk_matches_player_one` FOREIGN KEY (`player_one_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_matches_player_two` FOREIGN KEY (`player_two_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_matches_stage` FOREIGN KEY (`stage_id`) REFERENCES `stages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_matches_winner` FOREIGN KEY (`winner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=263 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- match_answers
CREATE TABLE `match_answers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `question_id` bigint(20) unsigned DEFAULT NULL,
  `word_id` bigint(20) unsigned DEFAULT NULL,
  `round` smallint(5) unsigned DEFAULT NULL,
  `answer_id` bigint(20) unsigned DEFAULT NULL,
  `answer_text` varchar(500) DEFAULT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0,
  `response_time_ms` int(10) unsigned DEFAULT NULL,
  `answered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_match_answers_attempt` (`match_id`,`user_id`,`question_id`),
  UNIQUE KEY `uq_match_answers_round` (`match_id`,`user_id`,`round`),
  KEY `idx_match_answers_user` (`user_id`,`match_id`),
  KEY `idx_match_answers_question` (`question_id`),
  KEY `idx_match_answers_answer` (`answer_id`),
  KEY `idx_match_answers_word` (`word_id`),
  CONSTRAINT `fk_match_answers_answer` FOREIGN KEY (`answer_id`) REFERENCES `answers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_match_answers_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_match_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_match_answers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_match_answers_word` FOREIGN KEY (`word_id`) REFERENCES `battle_words` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=260 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: League and activity
-- activity_events
CREATE TABLE `activity_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `kind` enum('lesson','video','duel_win','duel_play','answers','saved_word','login') NOT NULL,
  `ref_id` varchar(120) DEFAULT NULL,
  `amount` int(10) unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_activity_once` (`user_id`,`kind`,`ref_id`),
  KEY `idx_activity_user_kind_created` (`user_id`,`kind`,`created_at`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2235 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- season_payouts
CREATE TABLE `season_payouts` (
  `season_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `rank` int(10) unsigned NOT NULL,
  `race_points` int(10) unsigned NOT NULL,
  `rc_awarded` int(10) unsigned NOT NULL,
  `xp_awarded` int(10) unsigned NOT NULL,
  `paid_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tier` enum('coal','copper','iron','gold','redstone','lapis','diamond') NOT NULL,
  PRIMARY KEY (`season_id`,`user_id`),
  KEY `fk_payouts_user` (`user_id`),
  CONSTRAINT `fk_payouts_season` FOREIGN KEY (`season_id`) REFERENCES `seasons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payouts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- season_standings
CREATE TABLE `season_standings` (
  `season_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `race_points` int(10) unsigned NOT NULL DEFAULT 0,
  `lessons` int(10) unsigned NOT NULL DEFAULT 0,
  `videos` int(10) unsigned NOT NULL DEFAULT 0,
  `duel_wins` int(10) unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tier` enum('coal','copper','iron','gold','redstone','lapis','diamond') NOT NULL DEFAULT 'coal',
  PRIMARY KEY (`season_id`,`user_id`),
  KEY `idx_standings_season_points` (`season_id`,`race_points`),
  KEY `fk_standings_user` (`user_id`),
  CONSTRAINT `fk_standings_season` FOREIGN KEY (`season_id`) REFERENCES `seasons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_standings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Profile and economy
-- economy_ledger
CREATE TABLE `economy_ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `currency` enum('rc','xp','rp') NOT NULL,
  `amount` int(11) NOT NULL,
  `source_type` varchar(40) NOT NULL,
  `source_id` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ledger_entry` (`user_id`,`currency`,`source_type`,`source_id`),
  KEY `idx_ledger_user_created` (`user_id`,`created_at`),
  CONSTRAINT `fk_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5300 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_badges
CREATE TABLE `user_badges` (
  `user_id` bigint(20) unsigned NOT NULL,
  `badge_id` bigint(20) unsigned NOT NULL,
  `awarded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`badge_id`),
  KEY `idx_user_badges_badge` (`badge_id`),
  CONSTRAINT `fk_user_badges_badge` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_user_badges_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_boosters
CREATE TABLE `user_boosters` (
  `user_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `kind` enum('streak_shield','xp_multiplier','rc_multiplier') NOT NULL,
  `charges` int(10) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`item_id`),
  KEY `idx_user_boosters_kind` (`user_id`,`kind`),
  KEY `fk_user_boosters_item` (`item_id`),
  CONSTRAINT `fk_user_boosters_item` FOREIGN KEY (`item_id`) REFERENCES `shop_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_boosters_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_equipment
CREATE TABLE `user_equipment` (
  `user_id` bigint(20) unsigned NOT NULL,
  `slot` enum('car','frame','nameplate') NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`slot`),
  KEY `idx_user_equipment_item` (`item_id`),
  CONSTRAINT `fk_user_equipment_item` FOREIGN KEY (`item_id`) REFERENCES `shop_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_equipment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_inventory
CREATE TABLE `user_inventory` (
  `user_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `acquired_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`item_id`),
  KEY `idx_user_inventory_item` (`item_id`),
  CONSTRAINT `fk_user_inventory_item` FOREIGN KEY (`item_id`) REFERENCES `shop_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_inventory_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module: Community and translation
-- chats
CREATE TABLE `chats` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `topic` enum('DAILY_CONVERSATION','TRAVEL','FOOD','SHOPPING','SCHOOL','FAMILY','HOBBIES','JOB_INTERVIEW','STUDY_COACH') NOT NULL DEFAULT 'DAILY_CONVERSATION',
  `title` varchar(200) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_chats_user_updated` (`user_id`,`updated_at`),
  CONSTRAINT `fk_chats_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=303 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- study_reminders
CREATE TABLE `study_reminders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) NOT NULL,
  `body` varchar(500) DEFAULT NULL,
  `due_at` datetime NOT NULL,
  `target_json` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `delivered_at` datetime DEFAULT NULL,
  `dismissed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reminders_user_due` (`user_id`,`due_at`),
  CONSTRAINT `fk_reminders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- translations
CREATE TABLE `translations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `original_text` text NOT NULL,
  `source_language` varchar(16) NOT NULL,
  `translated_text` text NOT NULL,
  `target_language` varchar(16) NOT NULL,
  `provider` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_translations_user_created` (`user_id`,`created_at`),
  CONSTRAINT `fk_translations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=919 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- messages
CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `chat_id` bigint(20) unsigned NOT NULL,
  `role` enum('USER','AI','SYSTEM') NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_messages_chat_created` (`chat_id`,`created_at`),
  CONSTRAINT `fk_messages_chat` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=651 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_feedback
CREATE TABLE `ai_feedback` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint(20) unsigned NOT NULL,
  `type` enum('GRAMMAR','VOCABULARY','TENSE','WORD_ORDER','OTHER') NOT NULL,
  `original_text` text NOT NULL,
  `corrected_text` text NOT NULL,
  `explanation` text NOT NULL,
  `rating` enum('helpful','not_helpful') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ai_feedback_message` (`message_id`),
  CONSTRAINT `fk_ai_feedback_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=147 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

