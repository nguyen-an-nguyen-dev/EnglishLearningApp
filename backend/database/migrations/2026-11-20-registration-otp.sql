-- ---------------------------------------------------------------------------
-- 2026-11-20: e-mail OTP for web registration
--
-- A registration is not written to `users` until the mailed six-digit code is
-- verified. The pending row keeps the already-hashed password, the HMAC of the
-- code and the resend bookkeeping; it is deleted as soon as the account exists.
--
-- Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-registration-otp.sql
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `pending_registrations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(254) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  -- HMAC-SHA256(email + code, JWT_SECRET): a database leak cannot reveal the code.
  `otp_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `send_count` smallint(5) unsigned NOT NULL DEFAULT 1,
  `last_sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pending_registrations_email` (`email`),
  KEY `idx_pending_registrations_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
