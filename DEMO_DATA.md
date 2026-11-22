# Demo data

## League learners

`npm run seed:demo` in `backend/` upserts 70 stable demo learners: ten each in
Coal, Copper, Iron, Gold, Redstone, Lapis and Diamond. Each has varied XP,
Race Points, coins, streaks and a deterministic illustrated avatar. The avatar
URLs use DiceBear's Notionists endpoint; if a network blocks that host, the web
leaderboard falls back to initials.

Usernames follow `demo_<tier>_<01-10>`, for example `demo_copper_01`. The shared
demo password is `Engorace@2026`. Do not reuse these credentials outside local
demonstrations. Existing non-admin learners are kept intact by the seed command;
the requested one-time tier reset is handled separately by
`scripts/reset-leagues-to-copper.mjs`, which writes a SQL backup before changing
the tier on users and current-season standings.

## Bootstrap database files

- `database/init.sql` creates the current schema, with tables ordered by their
  foreign-key dependencies.
- `database/seeds.sql` contains inserts for the current reference, content,
  user and activity dataset, including the demo learners present when the
  snapshot was exported.

Run `npm run db:verify` in `backend/` to import those two files into the scratch
database `english_learning_verify`, compare every table's row count with the
current configured database, and drop the scratch database after verification.
