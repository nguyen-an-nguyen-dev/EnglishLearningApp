-- ---------------------------------------------------------------------------
-- 2026-11-20: illustrated cosmetic catalogue
--
-- Adds the ten-car / ten-frame / eleven-nameplate catalogue whose shop art is
-- backed by illustrated assets. Existing keys keep their prices and unlock rules;
-- only the display copy and top-down palettes are refreshed.
--
-- Apply with: npx tsx scripts/apply-migration.ts database/migrations/2026-11-20-cosmetic-art.sql
-- ---------------------------------------------------------------------------

-- Cars: names and palettes match the ten vector models in CarSideArt.
UPDATE `shop_items` SET
  `name` = 'Xe vàng kinh điển',
  `description` = 'Chiếc xe đầu tiên của mọi tay đua Engorace.'
 WHERE `code` = 'car_default';

UPDATE `shop_items` SET
  `name` = 'Xe thể thao đỏ',
  `description` = 'Thân xe đỏ gọn, tem đua kéo dài tới đuôi.'
 WHERE `code` = 'car_sport_red';

UPDATE `shop_items` SET
  `name` = 'Xe van bạc hà',
  `description` = 'Van nhỏ bạc hà, cao ráo và len lỏi tốt trong phố.',
  `style_json` = '{"body":"#6FD3B8","bodyDark":"#3FA994","trim":"#1F7A6B","glass":"#4A6C7C","glassLight":"#8FB6C4","wheel":"#33474F","light":"#EAFFF8","trail":"#8BEFD4"}'
 WHERE `code` = 'car_mint';

UPDATE `shop_items` SET
  `name` = 'Xe navy đêm',
  `description` = 'Xanh navy sâu, chỉ dành cho người qua chặng 3.',
  `style_json` = '{"body":"#2F4B7C","bodyDark":"#20355A","trim":"#141F38","glass":"#5B7691","glassLight":"#93AEC6","wheel":"#1B2534","light":"#DCE9FF","trail":"#6C9BE8"}'
 WHERE `code` = 'car_navy';

UPDATE `shop_items` SET
  `name` = 'Xe cực quang',
  `description` = 'Dải cực quang xanh tím chạy dọc thân xe.'
 WHERE `code` = 'car_aurora';

UPDATE `shop_items` SET
  `name` = 'Xe hoàng kim',
  `description` = 'Toàn thân vàng kim, của những tay đua cấp 9.',
  `style_json` = '{"body":"#E8BE55","bodyDark":"#C2963A","trim":"#8A6A1F","glass":"#6C6252","glassLight":"#C0B296","wheel":"#4B4438","light":"#FFF6D6","trail":"#FFDE8A"}'
 WHERE `code` = 'car_gold';

-- Frames: the PNG art carries the ring, mascot head and paws; the palette here
-- is the fallback if an admin replays a procedural frame with the same key.
UPDATE `shop_items` SET
  `name` = 'Khung hổ lửa',
  `description` = 'Hổ con cam lửa ôm vành đồng, sọc hổ chạy quanh viền.',
  `style_json` = '{"ring":"#F2B544","ringDark":"#C88A22","accent":"#FFF0B8","motif":"laurel"}'
 WHERE `code` = 'frame_bronze';

UPDATE `shop_items` SET
  `name` = 'Khung gấu túi bạc',
  `description` = 'Gấu túi xám ôm vòng bạc lấp lánh.',
  `style_json` = '{"ring":"#D8E2EA","ringDark":"#93A3B3","accent":"#FFFFFF","motif":"stars"}'
 WHERE `code` = 'frame_silver';

UPDATE `shop_items` SET
  `name` = 'Khung cún vàng',
  `description` = 'Cún vàng mũm mĩm với những tia sáng quanh viền.',
  `style_json` = '{"ring":"#E8BE55","ringDark":"#C2963A","accent":"#FFF3C4","motif":"crown"}'
 WHERE `code` = 'frame_gold';

UPDATE `shop_items` SET
  `name` = 'Khung cú tinh tú',
  `description` = 'Cú nâu đội vòng sao tím, mắt tròn xoe.',
  `style_json` = '{"ring":"#9A7BE0","ringDark":"#6E52B4","accent":"#FFE9A8","motif":"stars"}'
 WHERE `code` = 'frame_violet';

UPDATE `shop_items` SET
  `name` = 'Khung kỳ lân',
  `description` = 'Kỳ lân pastel với sừng cầu vồng và đốm sáng thủy tinh.',
  `style_json` = '{"ring":"#7FD8E8","ringDark":"#4E9FB5","accent":"#E7C6F7","motif":"crystal"}'
 WHERE `code` = 'frame_prism';

-- Nameplates: same keys, now backed by scenic photographs.
UPDATE `shop_items` SET
  `name` = 'Nền núi mây',
  `description` = 'Dãy núi tuyết nhô lên khỏi biển mây lúc bình minh.'
 WHERE `code` = 'nameplate_slate';

UPDATE `shop_items` SET
  `name` = 'Nền biển mây',
  `description` = 'Những đám mây trắng cuồn cuộn dưới nắng.'
 WHERE `code` = 'nameplate_cyan';

UPDATE `shop_items` SET
  `name` = 'Nền hoàng hôn',
  `description` = 'Mặt trời lặn sau đồi cỏ, nhuộm vàng cả chân trời.'
 WHERE `code` = 'nameplate_sunset';

UPDATE `shop_items` SET
  `name` = 'Nền rừng xanh',
  `description` = 'Rừng thông xanh mát với nắng xuyên qua tán lá.'
 WHERE `code` = 'nameplate_forest';

UPDATE `shop_items` SET
  `name` = 'Nền đêm sao',
  `description` = 'Dải Ngân Hà và sao băng trên đỉnh núi tuyết.'
 WHERE `code` = 'nameplate_royal';

-- New cars (keys 23-26).
INSERT INTO `shop_items`
  (`code`, `name`, `description`, `slot`, `rarity`, `price`, `unlock_type`, `unlock_value`, `visual_key`, `style_json`, `sort_order`, `active`, `created_at`)
VALUES
  ('car_rickshaw','Xe lam tốc độ','Chiếc xe lam ba bánh sơn xanh, lách qua mọi con phố.','car','rare',280,'level','6','car_rickshaw','{"model":"taxi","body":"#2E8B57","bodyDark":"#1B5E3B","trim":"#E3B93F","glass":"#4E6476","glassLight":"#9DB2C2","wheel":"#2B3442","light":"#FFF6D6","trail":"#7BD389"}',70,1,'2026-11-20 09:00:00.000'),
  ('car_monster','Xe quái vật','Bánh khổng lồ và tiếng máy gầm vang cả đường đua.','car','epic',460,'stage','4','car_monster','{"model":"monster","body":"#7BC043","bodyDark":"#4C8A24","trim":"#2F5A13","glass":"#374A2E","glassLight":"#9ABD7A","wheel":"#20262E","light":"#F4FFD6","trail":"#A6E85C"}',80,1,'2026-11-20 09:00:00.000'),
  ('car_formula','Xe đua công thức','Bản thu nhỏ của một chiếc F1 đỏ rực, chỉ dành cho tay đua cứng.','car','legendary',720,'league','gold','car_formula','{"model":"formula","body":"#F25C4A","bodyDark":"#B6322A","trim":"#6E1714","glass":"#3A4652","glassLight":"#8FA2B2","wheel":"#1F2630","light":"#FFF0C2","trail":"#FF8A5C"}',90,1,'2026-11-20 09:00:00.000'),
  ('car_jeep','Jeep đường dài','Gầm cao, lốp dự phòng, sẵn sàng cho mọi chặng đường.','car','epic',380,'level','8','car_jeep','{"model":"jeep","body":"#D9534F","bodyDark":"#A83A36","trim":"#7A1F1C","glass":"#4B5C63","glassLight":"#9FB4B8","wheel":"#2A2622","light":"#FFF1C9","trail":"#F08A7E"}',100,1,'2026-11-20 09:00:00.000')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `description` = VALUES(`description`), `slot` = VALUES(`slot`),
  `rarity` = VALUES(`rarity`), `price` = VALUES(`price`), `unlock_type` = VALUES(`unlock_type`),
  `unlock_value` = VALUES(`unlock_value`), `visual_key` = VALUES(`visual_key`),
  `style_json` = VALUES(`style_json`), `sort_order` = VALUES(`sort_order`), `active` = VALUES(`active`);

-- New frames (keys 27-30).
INSERT INTO `shop_items`
  (`code`, `name`, `description`, `slot`, `rarity`, `price`, `unlock_type`, `unlock_value`, `visual_key`, `style_json`, `sort_order`, `active`, `created_at`)
VALUES
  ('frame_sakura','Khung mèo anh đào','Mèo vàng tinh nghịch trong vòng hoa anh đào.','frame','epic',340,'level','6','frame_sakura','{"ring":"#F2A7C3","ringDark":"#C86B92","accent":"#FFE3EF","motif":"sakura"}',170,1,'2026-11-20 09:00:00.000'),
  ('frame_dragon','Khung rồng lửa','Rồng ngọc canh vòng nguyệt quế, ánh vàng trên nền xanh.','frame','legendary',560,'stage','5','frame_dragon','{"ring":"#2E8B57","ringDark":"#1B5E3B","accent":"#FFB03A","motif":"dragon"}',180,1,'2026-11-20 09:00:00.000'),
  ('frame_ocean','Khung cánh cụt biển','Cánh cụt nhỏ với những bong bóng biển xanh.','frame','rare',300,'level','7','frame_ocean','{"ring":"#3AA6C9","ringDark":"#1F6F8B","accent":"#C8F4FF","motif":"ocean"}',190,1,'2026-11-20 09:00:00.000'),
  ('frame_neon','Khung cáo neon','Cáo cam tinh nghịch trong vầng sáng neon tím.','frame','epic',480,'achievement','xp_500','frame_neon','{"ring":"#5B4BC4","ringDark":"#312A78","accent":"#3EF2E0","motif":"neon"}',200,1,'2026-11-20 09:00:00.000')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `description` = VALUES(`description`), `slot` = VALUES(`slot`),
  `rarity` = VALUES(`rarity`), `price` = VALUES(`price`), `unlock_type` = VALUES(`unlock_type`),
  `unlock_value` = VALUES(`unlock_value`), `visual_key` = VALUES(`visual_key`),
  `style_json` = VALUES(`style_json`), `sort_order` = VALUES(`sort_order`), `active` = VALUES(`active`);

-- New nameplates (keys 31-35).
INSERT INTO `shop_items`
  (`code`, `name`, `description`, `slot`, `rarity`, `price`, `unlock_type`, `unlock_value`, `visual_key`, `style_json`, `sort_order`, `active`, `created_at`)
VALUES
  ('nameplate_desert','Nền sa mạc','Nắng chiều nhuộm đỏ những mỏm đá sa mạc.','nameplate','rare',260,'stage','3','plate_desert','{"scene":"desert"}',270,1,'2026-11-20 09:00:00.000'),
  ('nameplate_space','Nền tinh vân','Tinh vân xanh tím giữa lòng vũ trụ.','nameplate','epic',480,'level','8','plate_space','{"scene":"space"}',280,1,'2026-11-20 09:00:00.000'),
  ('nameplate_sakura','Nền hoa anh đào','Cành anh đào nở rộ dưới nắng xuân.','nameplate','epic',400,'level','6','plate_sakura','{"scene":"sakura"}',290,1,'2026-11-20 09:00:00.000'),
  ('nameplate_ocean','Nền đại dương','Sóng biển trong veo và bờ cát vàng.','nameplate','rare',300,'level','5','plate_ocean','{"scene":"ocean"}',300,1,'2026-11-20 09:00:00.000'),
  ('nameplate_aurora','Nền cực quang','Dải sáng xanh tím trên bầu trời tuyết.','nameplate','legendary',600,'league','gold','plate_aurora','{"scene":"aurora"}',305,1,'2026-11-20 09:00:00.000')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `description` = VALUES(`description`), `slot` = VALUES(`slot`),
  `rarity` = VALUES(`rarity`), `price` = VALUES(`price`), `unlock_type` = VALUES(`unlock_type`),
  `unlock_value` = VALUES(`unlock_value`), `visual_key` = VALUES(`visual_key`),
  `style_json` = VALUES(`style_json`), `sort_order` = VALUES(`sort_order`), `active` = VALUES(`active`);
