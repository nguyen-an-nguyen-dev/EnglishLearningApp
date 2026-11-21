-- ---------------------------------------------------------------------------
-- 2026-11-21: league tiers move to the seven-ore Minecraft ladder
--
--   coal → copper → iron → gold → redstone → lapis → diamond
--
-- The enum is widened to a superset of every tier name that has ever been in
-- play (the original metals bronze/silver, the manual iron/gold/diamond/
-- netherite set, and the new ores) so no row is dropped, remapped, then
-- narrowed to the final ladder.
--
-- Existing names that survive are kept as-is (iron, gold, diamond); the rest
-- map onto the closest ore: bronze→coal, silver→copper, netherite→diamond.
-- League-locked shop items follow the same rename.
--
-- Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/2026-11-21-league-ore-tiers.sql
-- ---------------------------------------------------------------------------

-- 1. Widen the three enum columns to every known tier name.
ALTER TABLE `users`
  MODIFY COLUMN `league_tier`
    enum('bronze','silver','iron','gold','diamond','netherite','coal','copper','redstone','lapis')
    NOT NULL DEFAULT 'bronze';

ALTER TABLE `season_standings`
  MODIFY COLUMN `tier`
    enum('bronze','silver','iron','gold','diamond','netherite','coal','copper','redstone','lapis')
    NOT NULL DEFAULT 'bronze';

ALTER TABLE `season_payouts`
  MODIFY COLUMN `tier`
    enum('bronze','silver','iron','gold','diamond','netherite','coal','copper','redstone','lapis')
    NOT NULL;

-- 2. Remap legacy names onto the new ladder (iron / gold / diamond keep theirs).
UPDATE `users`            SET `league_tier` = 'coal'    WHERE `league_tier` = 'bronze';
UPDATE `users`            SET `league_tier` = 'copper'  WHERE `league_tier` = 'silver';
UPDATE `users`            SET `league_tier` = 'diamond' WHERE `league_tier` = 'netherite';
UPDATE `season_standings` SET `tier` = 'coal'    WHERE `tier` = 'bronze';
UPDATE `season_standings` SET `tier` = 'copper'  WHERE `tier` = 'silver';
UPDATE `season_standings` SET `tier` = 'diamond' WHERE `tier` = 'netherite';
UPDATE `season_payouts`   SET `tier` = 'coal'    WHERE `tier` = 'bronze';
UPDATE `season_payouts`   SET `tier` = 'copper'  WHERE `tier` = 'silver';
UPDATE `season_payouts`   SET `tier` = 'diamond' WHERE `tier` = 'netherite';

-- League-unlocked shop items follow the rename too (unlock_value is a varchar).
UPDATE `shop_items`
   SET `unlock_value` = 'copper'
 WHERE `unlock_type` = 'league' AND `unlock_value` = 'silver';
UPDATE `shop_items`
   SET `unlock_value` = 'diamond'
 WHERE `unlock_type` = 'league' AND `unlock_value` = 'netherite';

-- 3. Narrow to the final seven-ore ladder.
ALTER TABLE `users`
  MODIFY COLUMN `league_tier`
    enum('coal','copper','iron','gold','redstone','lapis','diamond')
    NOT NULL DEFAULT 'coal';

ALTER TABLE `season_standings`
  MODIFY COLUMN `tier`
    enum('coal','copper','iron','gold','redstone','lapis','diamond')
    NOT NULL DEFAULT 'coal';

ALTER TABLE `season_payouts`
  MODIFY COLUMN `tier`
    enum('coal','copper','iron','gold','redstone','lapis','diamond')
    NOT NULL;
