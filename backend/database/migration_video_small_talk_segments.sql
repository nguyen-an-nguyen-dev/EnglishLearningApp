-- Give the remaining YouTube sample lesson real listening segments taken from
-- the opening of its English captions, so every library card supports practice.

INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)
SELECT v.id, s.start_ms, s.end_ms, s.text_en, s.text_vi, s.sort_order
FROM video_lessons v
JOIN (
  SELECT
    11040 AS start_ms,
    16000 AS end_ms,
    'Welcome to EnglishClass101.com. English in Three Minutes.' AS text_en,
    'Chào mừng đến với EnglishClass101.com. Tiếng Anh trong ba phút.' AS text_vi,
    1 AS sort_order
  UNION ALL
  SELECT
    16000,
    21199,
    'The fastest, easiest and most fun way to learn English.',
    'Cách học tiếng Anh nhanh nhất, dễ nhất và thú vị nhất.',
    2
  UNION ALL
  SELECT
    21199,
    28640,
    'Hi, how''s it going? I''m Alicia. Nice to meet you.',
    'Chào bạn, dạo này thế nào? Tôi là Alicia. Rất vui được gặp bạn.',
    3
) s
WHERE v.code = 'video-small-talk'
  AND NOT EXISTS (SELECT 1 FROM video_segments x WHERE x.video_id = v.id);
