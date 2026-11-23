-- Consolidate Lapis into Redstone before narrowing the tier enums.
START TRANSACTION;
UPDATE users SET league_tier = 'redstone', updated_at = updated_at WHERE league_tier = 'lapis';
UPDATE season_standings SET tier = 'redstone', updated_at = updated_at WHERE tier = 'lapis';
UPDATE season_payouts SET tier = 'redstone' WHERE tier = 'lapis';
UPDATE shop_items SET unlock_value = 'redstone' WHERE unlock_type = 'league' AND unlock_value = 'lapis';
COMMIT;

ALTER TABLE users
  MODIFY league_tier ENUM('coal','copper','iron','gold','redstone','diamond') NOT NULL DEFAULT 'coal';
ALTER TABLE season_standings
  MODIFY tier ENUM('coal','copper','iron','gold','redstone','diamond') NOT NULL DEFAULT 'coal';
ALTER TABLE season_payouts
  MODIFY tier ENUM('coal','copper','iron','gold','redstone','diamond') NOT NULL;
