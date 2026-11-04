-- Give the short local sample lessons a segment so Parrot listening practice works there too.

INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)
SELECT v.id, 0, v.duration_seconds * 1000, v.subtitle_en, v.subtitle_vi, 1
FROM video_lessons v
LEFT JOIN video_segments s ON s.video_id = v.id
WHERE v.code IN ('video-cafe-order', 'video-travel-directions')
  AND v.subtitle_en IS NOT NULL
  AND s.id IS NULL;
