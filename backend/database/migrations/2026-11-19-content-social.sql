-- ---------------------------------------------------------------------------
-- 2026-11-19: admin-managed catalogue + social identities
--
-- Idempotent for MariaDB 10.3+ / MySQL 8.0 (ADD COLUMN IF NOT EXISTS).
-- Apply with: npx tsx scripts/apply-migration.ts database/migrations/2026-11-19-content-social.sql
-- ---------------------------------------------------------------------------

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_set` tinyint(1) NOT NULL DEFAULT 1 AFTER `role`;

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `streak_lost` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `streak`;

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `streak_lost_at` date DEFAULT NULL AFTER `streak_lost`;

CREATE TABLE IF NOT EXISTS `user_providers` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `shop_items` ADD COLUMN IF NOT EXISTS `booster_kind` enum('streak_shield','xp_multiplier','rc_multiplier') DEFAULT NULL AFTER `style_json`;

ALTER TABLE `shop_items` ADD COLUMN IF NOT EXISTS `booster_charges` int(10) unsigned NOT NULL DEFAULT 0 AFTER `booster_kind`;

ALTER TABLE `shop_items` ADD COLUMN IF NOT EXISTS `booster_duration_minutes` int(10) unsigned NOT NULL DEFAULT 0 AFTER `booster_charges`;

UPDATE `shop_items` SET `booster_kind` = 'streak_shield', `booster_charges` = 1
 WHERE `code` = 'booster_streak_shield' AND `booster_kind` IS NULL;

UPDATE `shop_items` SET `booster_kind` = 'xp_multiplier', `booster_duration_minutes` = 30
 WHERE `code` = 'booster_xp2' AND `booster_kind` IS NULL;

UPDATE `shop_items` SET `booster_kind` = 'rc_multiplier', `booster_charges` = 1
 WHERE `code` = 'booster_rc2' AND `booster_kind` IS NULL;

UPDATE `shop_items` SET `booster_kind` = 'streak_shield', `booster_charges` = 3
 WHERE `code` = 'booster_starter' AND `booster_kind` IS NULL;

-- Video learning seed: vocabulary for every shared lesson that ships segments.
INSERT IGNORE INTO `video_vocabulary`
  (`video_id`, `word`, `ipa`, `meaning_vi`, `detail_vi`, `sort_order`)
SELECT v.id, s.word, s.ipa, s.meaning_vi, s.detail_vi, s.sort_order
FROM `video_lessons` v
JOIN (
  SELECT 'video-small-talk' AS code, 'coworker' AS word, '/ˈkoʊˌwɜːrkər/' AS ipa,
         'đồng nghiệp' AS meaning_vi,
         'Người cùng làm việc trong một công ty. "My coworkers are really friendly."' AS detail_vi,
         1 AS sort_order
  UNION ALL SELECT 'video-small-talk', 'friendly', '/ˈfrendli/', 'thân thiện',
         'Dễ gần và tốt với người khác. "Everyone here is friendly and helpful."', 2
  UNION ALL SELECT 'video-small-talk', 'helpful', '/ˈhelpfl/', 'hay giúp đỡ',
         'Sẵn sàng giúp người khác khi cần. "They help me feel welcome."', 3
  UNION ALL SELECT 'video-small-talk', 'atmosphere', '/ˈætməsfɪr/', 'bầu không khí',
         'Cảm giác chung của một nơi làm việc. "It has an energetic atmosphere."', 4
  UNION ALL SELECT 'video-small-talk', 'hilarious', '/hɪˈleriəs/', 'rất buồn cười',
         'Cực kỳ hài hước. "My boss is hilarious."', 5
  UNION ALL SELECT 'video-small-talk', 'flexible', '/ˈfleksəbl/', 'linh hoạt',
         'Có thể thay đổi giờ giấc cho phù hợp. "He is really flexible about hours."', 6
  UNION ALL SELECT 'video-small-talk', 'dress code', '/ˈdres koʊd/', 'quy định trang phục',
         'Quy tắc về quần áo khi đến nơi làm việc. "There is no real dress code."', 7
  UNION ALL SELECT 'video-small-talk', 'sunrise', '/ˈsʌnraɪz/', 'bình minh',
         'Lúc mặt trời mọc. "I love watching the sunrise with my coffee."', 8
  UNION ALL SELECT 'video-past-trip', 'trip', '/trɪp/', 'chuyến đi',
         'Một chuyến đi ngắn hoặc chuyến du lịch. "How was your trip?"', 1
  UNION ALL SELECT 'video-past-trip', 'weather', '/ˈweðər/', 'thời tiết',
         'Tình trạng khí hậu trong một ngày. "The weather was beautiful."', 2
  UNION ALL SELECT 'video-past-trip', 'sunny', '/ˈsʌni/', 'nắng',
         'Có nhiều ánh nắng mặt trời. "It was warm and sunny every day."', 3
  UNION ALL SELECT 'video-past-trip', 'sightseeing', '/ˈsaɪtsiːɪŋ/', 'đi tham quan',
         'Đi thăm những điểm nổi tiếng. "I did some sightseeing."', 4
  UNION ALL SELECT 'video-past-trip', 'delicious', '/dɪˈlɪʃəs/', 'ngon',
         'Có vị rất ngon. "I ate at some delicious restaurants."', 5
  UNION ALL SELECT 'video-past-trip', 'reasonable', '/ˈriːznəbl/', 'hợp lý (giá cả)',
         'Không quá đắt. "I think the price was reasonable."', 6
  UNION ALL SELECT 'video-past-trip', 'vacation', '/veɪˈkeɪʃn/', 'kỳ nghỉ',
         'Thời gian nghỉ để đi du lịch. "You had a wonderful vacation."', 7
  UNION ALL SELECT 'video-past-trip', 'food poisoning', '/fuːd ˈpɔɪzənɪŋ/', 'ngộ độc thực phẩm',
         'Bị bệnh sau khi ăn thức ăn không an toàn. "I got food poisoning."', 8
  UNION ALL SELECT 'video-viva-la-vida', 'rule', '/ruːl/', 'cai trị; quy tắc',
         'Điều khiển hoặc quản lý. "I used to rule the world."', 1
  UNION ALL SELECT 'video-viva-la-vida', 'rise', '/raɪz/', 'dâng lên',
         'Đi lên hoặc tăng lên. "Seas would rise when I gave the word."', 2
  UNION ALL SELECT 'video-viva-la-vida', 'sweep', '/swiːp/', 'quét',
         'Làm sạch bằng chổi. "Sweep the streets I used to own."', 3
  UNION ALL SELECT 'video-viva-la-vida', 'own', '/oʊn/', 'sở hữu',
         'Có thứ gì đó thuộc về mình. "The streets I used to own."', 4
  UNION ALL SELECT 'video-viva-la-vida', 'world', '/wɜːrld/', 'thế giới',
         'Toàn bộ hành tinh hoặc mọi người. "I used to rule the world."', 5
  UNION ALL SELECT 'video-viva-la-vida', 'sleep', '/sliːp/', 'ngủ',
         'Nghỉ ngơi với mắt nhắm. "Now in the morning I sleep alone."', 6
  UNION ALL SELECT 'video-viva-la-vida', 'word', '/wɜːrd/', 'lời nói',
         'Một đơn vị ngôn ngữ. "When I gave the word."', 7
  UNION ALL SELECT 'video-viva-la-vida', 'morning', '/ˈmɔːrnɪŋ/', 'buổi sáng',
         'Phần đầu của ngày. "Now in the morning I sleep alone."', 8
  UNION ALL SELECT 'video-the-nights', 'shadow', '/ˈʃædoʊ/', 'bóng tối',
         'Vùng tối do vật cản ánh sáng. "When all our shadows disappeared."', 1
  UNION ALL SELECT 'video-the-nights', 'disappear', '/ˌdɪsəˈpɪr/', 'biến mất',
         'Không còn nhìn thấy nữa. "All our shadows disappeared."', 2
  UNION ALL SELECT 'video-the-nights', 'fear', '/fɪr/', 'nỗi sợ',
         'Cảm giác lo lắng trước nguy hiểm. "Face to face with all our fears."', 3
  UNION ALL SELECT 'video-the-nights', 'tear', '/tɪr/', 'nước mắt',
         'Giọt nước từ mắt khi khóc. "We learned our lessons through the tears."', 4
  UNION ALL SELECT 'video-the-nights', 'memory', '/ˈmeməri/', 'kỷ niệm',
         'Điều còn nhớ về quá khứ. "Made memories we knew would never fade."', 5
  UNION ALL SELECT 'video-the-nights', 'dream', '/driːm/', 'giấc mơ',
         'Hình ảnh trong khi ngủ hoặc điều mong ước. "Dreaming about the things we could be."', 6
  UNION ALL SELECT 'video-the-nights', 'lesson', '/ˈlesn/', 'bài học',
         'Điều học được từ trải nghiệm. "We learned our lessons through the tears."', 7
  UNION ALL SELECT 'video-the-nights', 'play', '/pleɪ/', 'vui chơi',
         'Làm điều gì đó để giải trí. "The animals inside came out to play."', 8
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'lose sleep', '/luːz sliːp/', 'mất ngủ',
         'Không ngủ được vì lo nghĩ. "I have been losing sleep."', 1
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'dream', '/driːm/', 'mơ ước',
         'Nghĩ về điều mình mong muốn. "Dreaming about the things that we could be."', 2
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'pray', '/preɪ/', 'cầu nguyện',
         'Nói chuyện với thần linh hoặc cầu mong điều tốt. "I have been praying hard."', 3
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'count', '/kaʊnt/', 'đếm',
         'Xác định số lượng. "We will be counting stars."', 4
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'swing', '/swɪŋ/', 'đu đưa',
         'Chuyển động qua lại. "Life is like a swinging vine."', 5
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'vine', '/vaɪn/', 'dây leo',
         'Cây leo có thân dài. "A swinging vine."', 6
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'bold', '/boʊld/', 'tự tin, táo bạo',
         'Dám làm điều khó. "Young but I am not that bold."', 7
  UNION ALL SELECT 'yt_hT_nvWreIhg_shared', 'alive', '/əˈlaɪv/', 'còn sống, sống động',
         'Cảm thấy tràn đầy sức sống. "Everything that kills me makes me feel alive."', 8
) s ON s.code = v.code;
