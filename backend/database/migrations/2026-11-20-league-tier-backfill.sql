-- ---------------------------------------------------------------------------
-- 2026-11-20: backfill persistent league tiers from existing standings
--
-- `users.league_tier` was added with a bronze default, so every existing learner
-- looked bronze even when their latest standings row said gold. Seed the column
-- from the newest season (the active one first) once; after this the column is
-- the source of truth and settlement only moves it.
--
-- Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-league-tier-backfill.sql
--
-- Only fills the default. A learner who already earned a tier is never
-- downgraded by re-running this one-time data fix.
-- ---------------------------------------------------------------------------

UPDATE `users` u
   SET u.league_tier = (
     SELECT st.tier
       FROM `season_standings` st
       JOIN `seasons` s ON s.id = st.season_id
      WHERE st.user_id = u.id
      ORDER BY (s.status = 'active') DESC, s.ends_at DESC
      LIMIT 1
   )
 WHERE u.league_tier = 'bronze'
   AND EXISTS (
     SELECT 1
       FROM `season_standings` st
       JOIN `seasons` s ON s.id = st.season_id
      WHERE st.user_id = u.id AND st.tier <> 'bronze'
   );
