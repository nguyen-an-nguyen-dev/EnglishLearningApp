-- ---------------------------------------------------------------------------
-- 2026-11-20: persistent league tier for promotion / demotion
--
-- A learner's tier is no longer recomputed from the current week's RP. It is
-- carried across seasons and only changes at settlement: top 6 go up one tier,
-- bottom 6 go down one tier.
--
-- Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-league-promotion.sql
-- ---------------------------------------------------------------------------

ALTER TABLE `users`
  ADD COLUMN `league_tier` enum('bronze','silver','gold','diamond') NOT NULL DEFAULT 'bronze' AFTER `role`;
