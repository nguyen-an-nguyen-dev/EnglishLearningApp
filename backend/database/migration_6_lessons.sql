-- ============================================================================
-- Bổ sung lesson thứ 6 cho mỗi stage + theme màu cho 6 stage
-- Chạy một lần trên database english_learning hiện có:
--   mysql -u root -p english_learning < migration_6_lessons.sql
-- Hoặc: node database/run-migration.mjs
-- ============================================================================

USE english_learning;

-- ----------------------------------------------------------------------------
-- 1. Theme metadata cho stage (dùng cho background bản đồ + thanh tiến trình)
-- ----------------------------------------------------------------------------
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS theme_key VARCHAR(40) NOT NULL DEFAULT 'forest' AFTER description,
  ADD COLUMN IF NOT EXISTS accent_color CHAR(7) NOT NULL DEFAULT '#00ABDC' AFTER theme_key;

UPDATE stages SET theme_key = 'forest',   accent_color = '#3E9B5F' WHERE code = 'stage-1';
UPDATE stages SET theme_key = 'river',    accent_color = '#2E9CC4' WHERE code = 'stage-2';
UPDATE stages SET theme_key = 'autumn',   accent_color = '#D97706' WHERE code = 'stage-3';
UPDATE stages SET theme_key = 'alpine',   accent_color = '#2E7DA8' WHERE code = 'stage-4';
UPDATE stages SET theme_key = 'coast',    accent_color = '#2A9D8F' WHERE code = 'stage-5';
UPDATE stages SET theme_key = 'sakura',   accent_color = '#D65A86' WHERE code = 'stage-6';

START TRANSACTION;

-- ----------------------------------------------------------------------------
-- 2. Lesson thứ 6 cho từng stage
-- ----------------------------------------------------------------------------
INSERT INTO lessons (stage_id, code, title, topic, sort_order) VALUES
  ((SELECT id FROM stages WHERE code = 'stage-1'), 's1-time', 'Giờ giấc & Ngày tháng', 'Time & Dates', 6),
  ((SELECT id FROM stages WHERE code = 'stage-2'), 's2-health', 'Sức khỏe & Bác sĩ', 'Health', 6),
  ((SELECT id FROM stages WHERE code = 'stage-3'), 's3-environment', 'Môi trường & Thiên nhiên', 'Environment', 6),
  ((SELECT id FROM stages WHERE code = 'stage-4'), 's4-presentations', 'Thuyết trình & Trình bày', 'Presentations', 6),
  ((SELECT id FROM stages WHERE code = 'stage-5'), 's5-media', 'Truyền thông & Xã hội', 'Media & Society', 6),
  ((SELECT id FROM stages WHERE code = 'stage-6'), 's6-literature', 'Văn học & Phê bình', 'Literature', 6)
ON DUPLICATE KEY UPDATE
  stage_id = VALUES(stage_id),
  title = VALUES(title),
  topic = VALUES(topic),
  sort_order = VALUES(sort_order);

-- ----------------------------------------------------------------------------
-- 3. 10 câu hỏi cho mỗi lesson mới (60 câu, mỗi câu 3 đáp án)
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS new_questions;
CREATE TEMPORARY TABLE new_questions (
  lesson_code VARCHAR(80) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
  correct_answer VARCHAR(500) NOT NULL,
  distractor_one VARCHAR(500) NOT NULL,
  distractor_two VARCHAR(500) NOT NULL,
  PRIMARY KEY (lesson_code, sort_order)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO new_questions
  (lesson_code, sort_order, question_text, explanation, difficulty, correct_answer, distractor_one, distractor_two)
VALUES
  -- Stage 1 · Time & Dates
  ('s1-time', 1, 'Câu nào dùng để hỏi "Mấy giờ rồi?"', 'Cấu trúc hỏi giờ là "What time is it?".', 'beginner', 'What time is it?', 'What day is it?', 'How old is it?'),
  ('s1-time', 2, 'Dịch "Monday" sang tiếng Việt.', '"Monday" là thứ Hai.', 'beginner', 'Thứ Hai', 'Thứ Ba', 'Chủ Nhật'),
  ('s1-time', 3, 'Tháng nào là tháng đầu tiên của năm?', 'Tháng đầu năm là January.', 'beginner', 'January', 'March', 'December'),
  ('s1-time', 4, 'Chọn giới từ đúng: "I get up ___ seven o''clock."', 'Dùng "at" trước giờ cụ thể.', 'beginner', 'at', 'on', 'in'),
  ('s1-time', 5, '"Buổi chiều" trong tiếng Anh là gì?', '"Afternoon" là buổi chiều.', 'beginner', 'afternoon', 'morning', 'evening'),
  ('s1-time', 6, 'Dịch "hôm nay" sang tiếng Anh.', '"Hôm nay" là today.', 'beginner', 'today', 'tomorrow', 'yesterday'),
  ('s1-time', 7, '"Half past six" là mấy giờ?', 'Half past six = 6 giờ 30.', 'beginner', '6:30', '6:00', '5:30'),
  ('s1-time', 8, 'Cuối tuần gồm những ngày nào?', 'Cuối tuần là thứ Bảy và Chủ Nhật.', 'beginner', 'Saturday and Sunday', 'Monday and Tuesday', 'Friday and Monday'),
  ('s1-time', 9, 'Chọn giới từ đúng: "My birthday is ___ May."', 'Dùng "in" trước tháng.', 'beginner', 'in', 'on', 'at'),
  ('s1-time', 10, 'Dịch "next week" sang tiếng Việt.', '"Next week" là tuần sau.', 'beginner', 'Tuần sau', 'Tuần trước', 'Tuần này'),

  -- Stage 2 · Health
  ('s2-health', 1, 'Khi bị đau đầu, bạn nên nói gì?', '"Headache" nghĩa là đau đầu.', 'beginner', 'I have a headache.', 'I have a toothache.', 'I have a backache.'),
  ('s2-health', 2, 'Dịch "bác sĩ" sang tiếng Anh.', '"Bác sĩ" là doctor.', 'beginner', 'doctor', 'teacher', 'driver'),
  ('s2-health', 3, 'Nơi bạn mua thuốc là gì?', 'Mua thuốc ở pharmacy (hiệu thuốc).', 'beginner', 'pharmacy', 'bakery', 'library'),
  ('s2-health', 4, 'Chọn động từ đúng: "You should ___ more water."', 'Uống nước dùng "drink".', 'beginner', 'drink', 'eat', 'sleep'),
  ('s2-health', 5, 'Triệu chứng "sốt" trong tiếng Anh là gì?', '"Sốt" là fever.', 'beginner', 'fever', 'cough', 'cold'),
  ('s2-health', 6, 'Dịch "I feel sick." sang tiếng Việt.', '"Sick" nghĩa là ốm/mệt.', 'beginner', 'Tôi cảm thấy ốm.', 'Tôi cảm thấy khỏe.', 'Tôi cảm thấy đói.'),
  ('s2-health', 7, 'Bạn nên làm gì khi bị cảm?', 'Nghỉ ngơi và uống nước ấm giúp hồi phục.', 'beginner', 'Rest and drink warm water.', 'Run outside for an hour.', 'Skip sleep and study all night.'),
  ('s2-health', 8, 'Nha sĩ trong tiếng Anh là gì?', '"Nha sĩ" là dentist.', 'beginner', 'dentist', 'doctor', 'nurse'),
  ('s2-health', 9, 'Chọn tính từ đúng: "She has a ___ throat."', 'Cụm "sore throat" nghĩa là đau họng.', 'beginner', 'sore', 'sour', 'safe'),
  ('s2-health', 10, 'Dịch "Take this medicine twice a day."', 'Twice a day = hai lần một ngày.', 'beginner', 'Uống thuốc này hai lần một ngày.', 'Uống thuốc này mỗi tuần một lần.', 'Mua thuốc này hai lần một ngày.'),

  -- Stage 3 · Environment
  ('s3-environment', 1, 'Dịch "môi trường" sang tiếng Anh.', '"Môi trường" là environment.', 'intermediate', 'environment', 'equipment', 'entertainment'),
  ('s3-environment', 2, 'Rác thải nhựa gây hại trực tiếp cho đâu?', 'Rác nhựa gây hại cho môi trường.', 'intermediate', 'the environment', 'the weather', 'the traffic'),
  ('s3-environment', 3, 'Chọn động từ đúng: "We should ___ plastic bags."', 'Giảm túi nhựa dùng "reduce".', 'intermediate', 'reduce', 'increase', 'produce'),
  ('s3-environment', 4, 'Năng lượng mặt trời trong tiếng Anh là gì?', '"Solar" là mặt trời.', 'intermediate', 'solar energy', 'wind energy', 'water energy'),
  ('s3-environment', 5, 'Dịch "climate change" sang tiếng Việt.', '"Climate change" là biến đổi khí hậu.', 'intermediate', 'Biến đổi khí hậu', 'Thời tiết đẹp', 'Không khí sạch'),
  ('s3-environment', 6, 'Việc trồng cây giúp ích gì cho không khí?', 'Cây làm sạch không khí.', 'intermediate', 'It cleans the air.', 'It makes more trash.', 'It wastes water.'),
  ('s3-environment', 7, 'Chọn tính từ đúng: "We must protect ___ animals."', '"Endangered" nghĩa là có nguy cơ tuyệt chủng.', 'intermediate', 'endangered', 'expensive', 'crowded'),
  ('s3-environment', 8, 'Từ "recycle" có nghĩa là gì?', '"Recycle" là tái chế.', 'intermediate', 'Tái chế', 'Tiêu hủy', 'Mua mới'),
  ('s3-environment', 9, 'Nguồn nước nào dùng để uống an toàn?', 'Nước sạch là fresh water.', 'intermediate', 'fresh water', 'salt water', 'dirty water'),
  ('s3-environment', 10, 'Dịch "Turn off the lights to save electricity."', 'Turn off = tắt; save electricity = tiết kiệm điện.', 'intermediate', 'Tắt đèn để tiết kiệm điện.', 'Bật đèn để dùng nhiều điện.', 'Tắt đèn để tăng hóa đơn.'),

  -- Stage 4 · Presentations
  ('s4-presentations', 1, 'Phần mở đầu bài thuyết trình thường gồm gì?', 'Mở đầu bằng giới thiệu chủ đề.', 'intermediate', 'Giới thiệu chủ đề', 'Danh sách tài liệu tham khảo', 'Lời cảm ơn cuối bài'),
  ('s4-presentations', 2, 'Dịch "slide" trong bài thuyết trình sang tiếng Việt.', '"Slide" là trang trình chiếu.', 'intermediate', 'Trang trình chiếu', 'Trang giấy', 'Bảng tin'),
  ('s4-presentations', 3, 'Câu nào mở đầu bài thuyết trình lịch sự?', 'Cách mở đầu chuẩn mực là giới thiệu chủ đề.', 'intermediate', 'Good morning, today I would like to talk about...', 'Give me your attention now.', 'I will finish as quickly as possible.'),
  ('s4-presentations', 4, 'Chọn cụm từ đúng: "Let''s move ___ to the next point."', 'Cụm "move on to" nghĩa là chuyển sang ý tiếp theo.', 'intermediate', 'on', 'out of', 'away from'),
  ('s4-presentations', 5, 'Từ "audience" nghĩa là gì?', '"Audience" là khán giả/người nghe.', 'intermediate', 'Khán giả', 'Diễn giả', 'Đồng nghiệp'),
  ('s4-presentations', 6, 'Bạn nên làm gì khi sắp hết thời gian thuyết trình?', 'Tóm tắt ý chính và cảm ơn khán giả.', 'intermediate', 'Tóm tắt ý chính và cảm ơn.', 'Nói nhanh hơn và bỏ qua kết luận.', 'Dừng lại mà không nói gì.'),
  ('s4-presentations', 7, 'Dịch "in conclusion" sang tiếng Việt.', '"In conclusion" dùng để kết luận.', 'intermediate', 'Tóm lại', 'Đầu tiên', 'Ví dụ'),
  ('s4-presentations', 8, 'Chọn động từ đúng: "The chart ___ the sales figures."', 'Chủ ngữ số ít "the chart" đi với "shows".', 'intermediate', 'shows', 'show', 'showing'),
  ('s4-presentations', 9, 'Câu nào mời khán giả đặt câu hỏi?', 'Câu mời hỏi lịch sự là "Are there any questions?".', 'intermediate', 'Are there any questions?', 'No questions are allowed.', 'Please leave the room now.'),
  ('s4-presentations', 10, 'Giao tiếp bằng mắt khi thuyết trình giúp gì?', 'Ánh mắt tạo kết nối với khán giả.', 'intermediate', 'Tạo kết nối với khán giả', 'Che giấu sự lo lắng', 'Đọc nhanh hơn'),

  -- Stage 5 · Media & Society
  ('s5-media', 1, 'Dịch "social media" sang tiếng Việt.', '"Social media" là mạng xã hội.', 'advanced', 'Mạng xã hội', 'Truyền hình', 'Báo giấy'),
  ('s5-media', 2, 'Tin tức giả trong tiếng Anh là gì?', 'Cụm "fake news" nghĩa là tin giả.', 'advanced', 'fake news', 'good news', 'breaking news'),
  ('s5-media', 3, 'Chọn động từ đúng: "We should ___ information before sharing it."', 'Cần kiểm chứng thông tin trước khi chia sẻ.', 'advanced', 'verify', 'ignore', 'delete'),
  ('s5-media', 4, 'Từ "influence" nghĩa là gì?', '"Influence" là ảnh hưởng.', 'advanced', 'Ảnh hưởng', 'Cấm đoán', 'Bỏ qua'),
  ('s5-media', 5, 'Nền tảng nào phát video trực tuyến?', 'Streaming platforms phát nội dung trực tuyến.', 'advanced', 'streaming platforms', 'printing presses', 'radio towers'),
  ('s5-media', 6, 'Dịch "privacy" sang tiếng Việt.', '"Privacy" là quyền riêng tư.', 'advanced', 'Quyền riêng tư', 'Sự nổi tiếng', 'Sự im lặng'),
  ('s5-media', 7, 'Câu nào thể hiện quan điểm trái chiều một cách lịch sự?', 'Cách phản biện lịch sự là thừa nhận ý kiến rồi nêu quan điểm khác.', 'advanced', 'I see your point, but...', 'You are completely wrong.', 'I do not care what you think.'),
  ('s5-media', 8, 'Chọn từ đúng: "The article went ___ last night."', 'Cụm "go viral" nghĩa là lan truyền nhanh.', 'advanced', 'viral', 'silent', 'local'),
  ('s5-media', 9, 'Quảng cáo trực tuyến thường nhắm vào ai?', 'Quảng cáo nhắm tới target audience.', 'advanced', 'target audience', 'foreign tourists', 'random strangers'),
  ('s5-media', 10, 'Dịch "freedom of speech" sang tiếng Việt.', '"Freedom of speech" là tự do ngôn luận.', 'advanced', 'Tự do ngôn luận', 'Tự do đi lại', 'Tự do tín ngưỡng'),

  -- Stage 6 · Literature
  ('s6-literature', 1, 'Từ "novel" nghĩa là gì?', '"Novel" là tiểu thuyết.', 'advanced', 'Tiểu thuyết', 'Bài thơ', 'Truyện ngắn'),
  ('s6-literature', 2, 'Dịch "nhân vật chính" sang tiếng Anh.', '"Nhân vật chính" là main character.', 'advanced', 'main character', 'side character', 'narrator'),
  ('s6-literature', 3, 'Chọn động từ đúng: "The author ___ a vivid picture of the city."', 'Chủ ngữ số ít "the author" đi với "paints".', 'advanced', 'paints', 'paint', 'painting'),
  ('s6-literature', 4, 'Từ "metaphor" nghĩa là gì?', '"Metaphor" là ẩn dụ.', 'advanced', 'Ẩn dụ', 'So sánh', 'Nhân hóa'),
  ('s6-literature', 5, 'Thể loại "biography" viết về điều gì?', 'Biography kể về cuộc đời một người.', 'advanced', 'Cuộc đời của một người', 'Một giả thuyết khoa học', 'Một chuyến phiêu lưu hư cấu'),
  ('s6-literature', 6, 'Dịch "plot" trong tác phẩm văn học.', '"Plot" là cốt truyện.', 'advanced', 'Cốt truyện', 'Bìa sách', 'Tác giả'),
  ('s6-literature', 7, 'Câu nào nhận xét văn phong phù hợp?', 'Nhận xét văn phong nên nói về cách viết.', 'advanced', 'The prose is elegant and precise.', 'The book is very heavy.', 'I bought it yesterday.'),
  ('s6-literature', 8, 'Từ "symbolism" liên quan đến điều gì?', 'Symbolism là việc dùng biểu tượng trong tác phẩm.', 'advanced', 'Biểu tượng trong tác phẩm', 'Số liệu thống kê', 'Ngữ pháp câu'),
  ('s6-literature', 9, 'Chọn giới từ đúng: "The novel explores themes ___ identity and loss."', 'Cụm "themes of" là cách nói đúng.', 'advanced', 'of', 'at', 'by'),
  ('s6-literature', 10, 'Dịch "critical analysis" sang tiếng Việt.', '"Critical analysis" là phân tích phê bình.', 'advanced', 'Phân tích phê bình', 'Phân tích hóa học', 'Đánh giá thể thao');

-- Upsert câu hỏi (giữ nguyên id nếu đã tồn tại)
INSERT INTO questions (lesson_id, question_text, question_type, explanation, difficulty, sort_order)
SELECT l.id, n.question_text, 'multiple_choice', n.explanation, n.difficulty, n.sort_order
FROM new_questions n
JOIN lessons l ON l.code = n.lesson_code
ON DUPLICATE KEY UPDATE
  question_text = VALUES(question_text),
  question_type = VALUES(question_type),
  explanation = VALUES(explanation),
  difficulty = VALUES(difficulty);

-- Đồng bộ lại 3 đáp án cho từng câu hỏi mới
DELETE a FROM answers a
JOIN questions q ON q.id = a.question_id
JOIN lessons l ON l.id = q.lesson_id
JOIN new_questions n ON n.lesson_code = l.code AND n.sort_order = q.sort_order;

INSERT INTO answers (question_id, answer_text, is_correct, sort_order)
SELECT q.id,
       CASE slot.n
         WHEN 1 THEN n.correct_answer
         WHEN 2 THEN n.distractor_one
         ELSE n.distractor_two
       END,
       slot.n = 1,
       slot.n
FROM new_questions n
JOIN lessons l ON l.code = n.lesson_code
JOIN questions q ON q.lesson_id = l.id AND q.sort_order = n.sort_order
JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3) AS slot;

DROP TEMPORARY TABLE IF EXISTS new_questions;

COMMIT;
