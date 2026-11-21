import 'dotenv/config';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

/**
 * Rebuilds the learner-facing data for a visual demo:
 * users, leaderboard, videos + captions, progress, activity, shop ownership,
 * badges, matches, chats, translations and reminders.
 *
 * Content configuration (stages, lessons, questions, shop catalogue, badges and
 * quests) is preserved. All deletes/inserts run in one transaction, so a failed
 * seed rolls back instead of leaving a half-empty database.
 */

const PASSWORD = 'Engorace@2026';
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning',
  charset: 'utf8mb4',
});

const USERS = [
  { name: 'Quản trị Engorace', username: 'admin', email: 'admin@engorace.demo', xp: 0, coins: 5000, streak: 18, lastDays: 0, role: 'admin', createdDays: 160 },
  { name: 'Nguyễn Minh Anh', username: 'minhanh', email: 'minhanh@engorace.demo', xp: 8600, coins: 2450, streak: 28, lastDays: 0, createdDays: 140 },
  { name: 'Trần Hoàng Nam', username: 'hoangnam', email: 'hoangnam@engorace.demo', xp: 7920, coins: 1800, streak: 22, lastDays: 0, createdDays: 130 },
  { name: 'Lê Thu Hà', username: 'thuha', email: 'thuha@engorace.demo', xp: 7250, coins: 3200, streak: 41, lastDays: 0, createdDays: 150 },
  { name: 'Phạm Quốc Bảo', username: 'quocbao', email: 'quocbao@engorace.demo', xp: 6840, coins: 900, streak: 16, lastDays: 1, createdDays: 120 },
  { name: 'Đỗ Khánh Linh', username: 'khanhlinh', email: 'khanhlinh@engorace.demo', xp: 6120, coins: 1500, streak: 19, lastDays: 0, createdDays: 110 },
  { name: 'Vũ Đức Huy', username: 'duchuy', email: 'duchuy@engorace.demo', xp: 5480, coins: 720, streak: 0, lost: 12, lostDays: 6, lastDays: 6, createdDays: 100 },
  { name: 'Hoàng Ngọc Mai', username: 'ngocmai', email: 'ngocmai@engorace.demo', xp: 4970, coins: 1100, streak: 9, lastDays: 0, createdDays: 95 },
  { name: 'Bùi Thanh Tùng', username: 'thanhtung', email: 'thanhtung@engorace.demo', xp: 4310, coins: 540, streak: 4, lastDays: 0, createdDays: 90 },
  { name: 'Ngô Hải Yến', username: 'haiyen', email: 'haiyen@engorace.demo', xp: 3880, coins: 810, streak: 31, lastDays: 0, createdDays: 85 },
  { name: 'Dương Gia Hân', username: 'giahan', email: 'giahan@engorace.demo', xp: 3420, coins: 460, streak: 7, lastDays: 0, createdDays: 80 },
  { name: 'Trịnh Văn Long', username: 'vanlong', email: 'vanlong@engorace.demo', xp: 2950, coins: 330, streak: 0, lost: 5, lostDays: 4, lastDays: 4, createdDays: 75 },
  { name: 'Lý Bảo Châu', username: 'baochau', email: 'baochau@engorace.demo', xp: 2640, coins: 690, streak: 12, lastDays: 0, createdDays: 70 },
  { name: 'Phan Nhật Minh', username: 'nhatminh', email: 'nhatminh@engorace.demo', xp: 2280, coins: 250, streak: 3, lastDays: 0, createdDays: 65 },
  { name: 'Đặng Thùy Dương', username: 'thuyduong', email: 'thuyduong@engorace.demo', xp: 1960, coins: 420, streak: 0, lost: 3, lostDays: 10, lastDays: 10, createdDays: 60 },
  { name: 'Hồ Anh Khoa', username: 'anhkhoa', email: 'anhkhoa@engorace.demo', xp: 1720, coins: 180, streak: 2, lastDays: 0, createdDays: 55 },
  { name: 'Võ Thảo Vy', username: 'thaovy', email: 'thaovy@engorace.demo', xp: 1450, coins: 360, streak: 6, lastDays: 0, createdDays: 50 },
  { name: 'Trương Gia Bảo', username: 'giabao', email: 'giabao@engorace.demo', xp: 1180, coins: 140, streak: 1, lastDays: 0, createdDays: 45 },
  { name: 'Lâm Tuyết Nhi', username: 'tuyetnhi', email: 'tuyetnhi@engorace.demo', xp: 920, coins: 210, streak: 0, lost: 5, lostDays: 8, lastDays: 8, createdDays: 40 },
  { name: 'Tạ Quang Huy', username: 'quanghuy', email: 'quanghuy@engorace.demo', xp: 760, coins: 90, streak: 4, lastDays: 0, createdDays: 35 },
  { name: 'Mai Phương Thảo', username: 'phuongthao', email: 'phuongthao@engorace.demo', xp: 600, coins: 150, streak: 2, lastDays: 0, createdDays: 30 },
  { name: 'Nguyễn Đức Anh', username: 'ducanh', email: 'ducanh@engorace.demo', xp: 430, coins: 60, streak: 0, lost: 2, lostDays: 5, lastDays: 5, createdDays: 25 },
  { name: 'Cao Thị Hồng', username: 'thihong', email: 'thihong@engorace.demo', xp: 310, coins: 80, streak: 1, lastDays: 0, createdDays: 20 },
  { name: 'Phạm Tuấn Kiệt', username: 'tuankiet', email: 'tuankiet@engorace.demo', xp: 180, coins: 40, streak: 0, lastDays: 2, createdDays: 15 },
  { name: 'Đinh Ngọc Ánh', username: 'ngocanh', email: 'ngocanh@engorace.demo', xp: 90, coins: 20, streak: 0, lastDays: 1, createdDays: 10 },
  { name: 'Bùi Minh Quân', username: 'minhquan', email: 'minhquan@engorace.demo', xp: 40, coins: 0, streak: 0, lastDays: 0, createdDays: 5 },
  { name: 'Nguyễn Gia Linh', username: 'gialinh', email: 'gialinh@engorace.demo', xp: 0, coins: 0, streak: 0, lastDays: null, createdDays: 2 },
];

const VIDEO_META = [
  {
    code: 'demo-small-talk',
    title: 'Small Talk at Work — Hỏi thăm đồng nghiệp',
    topic: 'Giao tiếp công sở',
    cefr: 'A2',
    description: 'Một cuộc trò chuyện ngắn ở công sở: hỏi thăm công việc mới, đồng nghiệp và cách giữ chuỗi ngày học.',
    sort: 1,
    xp: 25,
  },
  {
    code: 'demo-trip',
    title: 'A Trip to Remember — Kể lại chuyến đi',
    topic: 'Du lịch',
    cefr: 'A2',
    description: 'Luyện thì quá khứ đơn qua câu chuyện về thời tiết, món ăn và một chuyến đi đáng nhớ.',
    sort: 2,
    xp: 25,
  },
  {
    code: 'demo-viva',
    title: 'Viva La Vida — Luyện nghe qua bài hát',
    topic: 'Âm nhạc',
    cefr: 'B1',
    description: 'Nghe từng câu trong bản hit của Coldplay và gõ lại lời bài hát.',
    sort: 3,
    xp: 20,
  },
  {
    code: 'demo-nights',
    title: 'The Nights — Luyện nghe qua bài hát',
    topic: 'Âm nhạc',
    cefr: 'B1',
    description: 'Luyện phản xạ nghe với ca khúc The Nights của Avicii.',
    sort: 4,
    xp: 20,
  },
  {
    code: 'demo-counting-stars',
    title: 'Counting Stars — Luyện nghe qua bài hát',
    topic: 'Âm nhạc',
    cefr: 'B2',
    description: 'Một bài luyện nghe dài hơn với ca từ quen thuộc của OneRepublic.',
    sort: 5,
    xp: 30,
  },
];

const VIDEO_VOCAB = {
  'demo-small-talk': [
    ['coworker', '/ˈkoʊˌwɜːrkər/', 'đồng nghiệp', 'Người cùng làm việc trong một công ty.'],
    ['friendly', '/ˈfrendli/', 'thân thiện', 'Dễ gần và tốt với người khác.'],
    ['flexible', '/ˈfleksəbl/', 'linh hoạt', 'Có thể thay đổi cho phù hợp.'],
    ['atmosphere', '/ˈætməsfɪr/', 'bầu không khí', 'Cảm giác chung của một nơi.'],
  ],
  'demo-trip': [
    ['trip', '/trɪp/', 'chuyến đi', 'Một chuyến đi ngắn hoặc chuyến du lịch.'],
    ['weather', '/ˈweðər/', 'thời tiết', 'Tình trạng khí hậu trong ngày.'],
    ['sightseeing', '/ˈsaɪtsiːɪŋ/', 'đi tham quan', 'Đi thăm những điểm nổi tiếng.'],
    ['delicious', '/dɪˈlɪʃəs/', 'ngon', 'Có vị rất ngon.'],
  ],
  'demo-viva': [
    ['rule', '/ruːl/', 'cai trị', 'Điều khiển hoặc quản lý.'],
    ['rise', '/raɪz/', 'dâng lên', 'Đi lên hoặc tăng lên.'],
    ['sweep', '/swiːp/', 'quét', 'Làm sạch bằng chổi.'],
    ['own', '/oʊn/', 'sở hữu', 'Có thứ gì đó thuộc về mình.'],
  ],
  'demo-nights': [
    ['shadow', '/ˈʃædoʊ/', 'bóng tối', 'Vùng tối do vật cản ánh sáng.'],
    ['disappear', '/ˌdɪsəˈpɪr/', 'biến mất', 'Không còn nhìn thấy nữa.'],
    ['fear', '/fɪr/', 'nỗi sợ', 'Cảm giác lo lắng trước nguy hiểm.'],
    ['memory', '/ˈmeməri/', 'kỷ niệm', 'Điều còn nhớ về quá khứ.'],
  ],
  'demo-counting-stars': [
    ['lose sleep', '/luːz sliːp/', 'mất ngủ', 'Không ngủ được vì lo nghĩ.'],
    ['dream', '/driːm/', 'mơ ước', 'Nghĩ về điều mình mong muốn.'],
    ['pray', '/preɪ/', 'cầu nguyện', 'Cầu mong điều tốt đẹp.'],
    ['alive', '/əˈlaɪv/', 'sống động', 'Cảm thấy tràn đầy sức sống.'],
  ],
};

const FALLBACK_SEGMENTS = [
  'Hello and welcome to this English lesson.',
  'Today we are going to practice listening and speaking.',
  'Listen carefully, then type what you hear.',
  'Small steps every day make a big difference.',
  'See you in the next lesson.',
];

const CHAT_CONTENT = [
  ['DAILY_CONVERSATION', 'Kế hoạch học hôm nay', [
    ['USER', 'Hôm nay mình nên học gì để giữ chuỗi 28 ngày?'],
    ['AI', 'Bạn còn 2 bài nữa trong chặng 3. Học một bài ngắn trước, sau đó lưu 3 từ mới để hoàn thành quest ngày.'],
    ['USER', 'Nghe hợp lý. Mình sẽ bắt đầu với bài Du lịch.'],
  ]],
  ['TRAVEL', 'Ôn từ vựng du lịch', [
    ['USER', 'Cho mình 3 từ hay dùng khi ở sân bay.'],
    ['AI', 'Bạn có thể dùng boarding pass, departure gate và luggage. Mỗi từ đều có ví dụ trong sổ từ của bạn.'],
  ]],
  ['JOB_INTERVIEW', 'Chuẩn bị phỏng vấn', [
    ['USER', 'Mình nên trả lời “tell me about yourself” thế nào?'],
    ['AI', 'Hãy kể ngắn gọn về kinh nghiệm, một thành tích có số liệu và lý do bạn phù hợp với vị trí này.'],
  ]],
];

const TRANSLATION_SAMPLES = [
  ['Good morning! How are you today?', 'Chào buổi sáng! Hôm nay bạn thế nào?'],
  ['I would like a coffee and a croissant, please.', 'Tôi muốn một ly cà phê và một chiếc bánh sừng bò.'],
  ['The meeting has been moved to Friday afternoon.', 'Cuộc họp đã được dời sang chiều thứ Sáu.'],
  ['Could you help me find the nearest train station?', 'Bạn có thể giúp tôi tìm ga tàu gần nhất không?'],
  ['Learning a little every day is better than cramming.', 'Học một chút mỗi ngày tốt hơn là học nhồi.'],
  ['Can I have the bill, please?', 'Cho tôi xin hóa đơn được không?'],
  ['I am looking forward to the weekend.', 'Tôi đang mong đến cuối tuần.'],
  ['This neighborhood is quiet and family-friendly.', 'Khu này yên tĩnh và phù hợp với gia đình.'],
  ['She has been studying English for three years.', 'Cô ấy đã học tiếng Anh được ba năm.'],
  ['Could you repeat that more slowly?', 'Bạn có thể lặp lại chậm hơn không?'],
  ['The project deadline is next Wednesday.', 'Hạn chót của dự án là thứ Tư tới.'],
  ['I would rather stay home than go out tonight.', 'Tối nay tôi thà ở nhà còn hơn ra ngoài.'],
  ['Practice makes progress, not perfection.', 'Luyện tập tạo ra tiến bộ, không phải sự hoàn hảo.'],
];

const dateAgo = (daysAgo, hour = 0) => new Date(Date.now() - daysAgo * 86400000 - hour * 3600000);
const dateIn = (hours) => new Date(Date.now() + hours * 3600000);

const dateOnly = (daysAgo) => `DATE_SUB(CURDATE(), INTERVAL ${daysAgo} DAY)`;
const tierFor = (points) => (points >= 900 ? 'diamond' : points >= 500 ? 'gold' : points >= 200 ? 'silver' : 'bronze');

async function insertUser(user, passwordHash) {
  const lastActivity = user.lastDays === null ? 'NULL' : dateOnly(user.lastDays);
  const lostAt = user.lost ? dateOnly(user.lostDays ?? user.lastDays ?? 0) : 'NULL';
  const [result] = await connection.execute(
    `INSERT INTO users
       (username, email, password_hash, display_name, xp, coins, streak, streak_lost,
        streak_lost_at, last_activity_date, role, password_set, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${lostAt}, ${lastActivity}, ?, 1, DATE_SUB(NOW(), INTERVAL ${user.createdDays} DAY))`,
    [user.username, user.email, passwordHash, user.name, user.xp, user.coins, user.streak, user.lost ?? 0, user.role ?? 'learner'],
  );
  return result.insertId;
}

async function insertMany(sql, rows) {
  if (rows.length === 0) return;
  const width = rows[0].length;
  const chunkSize = Math.max(1, Math.floor(1000 / width));
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await connection.query(
      sql + ' VALUES ' + chunk.map(() => `(${Array(width).fill('?').join(',')})`).join(','),
      chunk.flat(),
    );
  }
}

try {
  await connection.beginTransaction();

  // Videos and captions are captured before the wipe and re-used with new
  // metadata, so the seeded lessons still have real caption timing.
  const [oldVideos] = await connection.query(
    'SELECT * FROM video_lessons WHERE owner_user_id IS NULL ORDER BY sort_order ASC, id ASC',
  );
  const [oldSegments] = await connection.query(
    'SELECT * FROM video_segments ORDER BY video_id, sort_order ASC',
  );
  const [oldVocabulary] = await connection.query(
    'SELECT * FROM video_vocabulary ORDER BY video_id, sort_order ASC',
  );

  const dynamicTables = [
    'ai_feedback', 'messages', 'chats', 'match_answers', 'matches',
    'learning_answer_attempts', 'video_progress', 'saved_words', 'progress',
    'study_reminders', 'user_badges', 'user_inventory', 'user_equipment',
    'user_boosters', 'season_payouts', 'season_standings', 'activity_events',
    'economy_ledger', 'translations', 'user_providers', 'video_vocabulary',
    'video_segments', 'video_lessons', 'users',
  ];
  for (const table of dynamicTables) {
    await connection.query(`DELETE FROM \`${table}\``);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const userIds = [];
  for (const user of USERS) {
    userIds.push(await insertUser(user, passwordHash));
  }
  const adminId = userIds[0];
  const learners = userIds.slice(1);
  const topUserIds = learners.slice(0, 8);

  // --- Videos -------------------------------------------------------------
  const oldById = new Map(oldVideos.map((row) => [Number(row.id), row]));
  const segmentsByOld = new Map();
  const vocabularyByOld = new Map();
  for (const row of oldSegments) {
    const list = segmentsByOld.get(Number(row.video_id)) ?? [];
    list.push(row);
    segmentsByOld.set(Number(row.video_id), list);
  }
  for (const row of oldVocabulary) {
    const list = vocabularyByOld.get(Number(row.video_id)) ?? [];
    list.push(row);
    vocabularyByOld.set(Number(row.video_id), list);
  }

  const newVideoIds = [];
  for (const [index, meta] of VIDEO_META.entries()) {
    const source = oldVideos[index % Math.max(oldVideos.length, 1)];
    const sourceSegments = source ? segmentsByOld.get(Number(source.id)) ?? [] : [];
    const sourceVocab = source ? vocabularyByOld.get(Number(source.id)) ?? [] : [];
    const [result] = await connection.execute(
      `INSERT INTO video_lessons
         (code, title, description, topic, cefr_level, provider, video_url, thumbnail_url,
          duration_seconds, xp_reward, sort_order, owner_user_id, subtitle_en, subtitle_vi, created_at)
       VALUES (?, ?, ?, ?, ?, 'youtube', ?, ?, ?, ?, ?, NULL, ?, NULL, DATE_SUB(NOW(), INTERVAL ${10 + index} DAY))`,
      [
        meta.code,
        meta.title,
        meta.description,
        meta.topic,
        meta.cefr,
        source?.video_url ?? 'https://www.youtube.com/watch?v=ry9SYnV3svc',
        source?.thumbnail_url ?? null,
        Number(source?.duration_seconds ?? 120),
        meta.xp,
        meta.sort,
        source?.subtitle_en ?? null,
      ],
    );
    const videoId = result.insertId;
    newVideoIds.push(videoId);
    const segments = sourceSegments.length > 0
      ? sourceSegments
      : FALLBACK_SEGMENTS.map((text, i) => ({
        start_ms: i * 8000,
        end_ms: (i + 1) * 8000,
        text_en: text,
        text_vi: null,
        sort_order: i + 1,
      }));
    await insertMany(
      'INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)',
      segments.map((segment, i) => [
        videoId,
        Number(segment.start_ms),
        Number(segment.end_ms),
        segment.text_en,
        segment.text_vi ?? null,
        Number(segment.sort_order ?? i + 1),
      ]),
    );
    const vocab = (sourceVocab.length > 0
      ? sourceVocab.map((entry) => [entry.word, entry.ipa, entry.meaning_vi, entry.detail_vi])
      : VIDEO_VOCAB[meta.code] ?? []);
    await insertMany(
      'INSERT INTO video_vocabulary (video_id, word, ipa, meaning_vi, detail_vi, sort_order)',
      vocab.map((entry, i) => [videoId, entry[0], entry[1], entry[2], entry[3], i + 1]),
    );
  }

  // A personal video makes the “Video của tôi” section visibly different.
  const personalSource = oldVideos[oldVideos.length - 1];
  const [personalResult] = await connection.execute(
    `INSERT INTO video_lessons
       (code, title, description, topic, cefr_level, provider, video_url, thumbnail_url,
        duration_seconds, xp_reward, sort_order, owner_user_id, subtitle_en, subtitle_vi, created_at)
     VALUES (?, ?, ?, 'Video của tôi', 'B2', 'youtube', ?, ?, ?, 0, 0, ?, ?, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY))`,
    [
      'demo-personal-counting-stars',
      'My Listening: Counting Stars',
      'Video cá nhân của Minh Anh để luyện nghe lại bài hát yêu thích.',
      personalSource?.video_url ?? 'https://www.youtube.com/watch?v=hT_nvWreIhg',
      personalSource?.thumbnail_url ?? null,
      Number(personalSource?.duration_seconds ?? 283),
      topUserIds[0],
      personalSource?.subtitle_en ?? null,
    ],
  );
  const personalVideoId = personalResult.insertId;
  const personalSegments = personalSource ? segmentsByOld.get(Number(personalSource.id)) ?? [] : [];
  const personalVocab = personalSource ? vocabularyByOld.get(Number(personalSource.id)) ?? [] : [];
  await insertMany(
    'INSERT INTO video_segments (video_id, start_ms, end_ms, text_en, text_vi, sort_order)',
    (personalSegments.length ? personalSegments : FALLBACK_SEGMENTS.map((text, i) => ({
      start_ms: i * 8000, end_ms: (i + 1) * 8000, text_en: text, sort_order: i + 1,
    }))).map((segment, i) => [
      personalVideoId,
      Number(segment.start_ms),
      Number(segment.end_ms),
      segment.text_en,
      segment.text_vi ?? null,
      Number(segment.sort_order ?? i + 1),
    ]),
  );
  await insertMany(
    'INSERT INTO video_vocabulary (video_id, word, ipa, meaning_vi, detail_vi, sort_order)',
    (personalVocab.length ? personalVocab : VIDEO_VOCAB['demo-counting-stars']).map((entry, i) => [
      personalVideoId,
      entry.word ?? entry[0],
      entry.ipa ?? entry[1],
      entry.meaning_vi ?? entry[2],
      entry.detail_vi ?? entry[3],
      i + 1,
    ]),
  );
  newVideoIds.push(personalVideoId);

  // --- Content/progression ------------------------------------------------
  const [lessonRows] = await connection.query(
    'SELECT id, stage_id FROM lessons ORDER BY stage_id ASC, sort_order ASC',
  );
  const [questionRows] = await connection.query(
    'SELECT id, lesson_id FROM questions ORDER BY lesson_id ASC, sort_order ASC',
  );
  const questionsByLesson = new Map();
  for (const question of questionRows) {
    const list = questionsByLesson.get(Number(question.lesson_id)) ?? [];
    list.push(Number(question.id));
    questionsByLesson.set(Number(question.lesson_id), list);
  }

  const progressRows = [];
  const attemptRows = [];
  const activityRows = [];
  const completedByUser = new Map();
  for (const [userIndex, userId] of learners.entries()) {
    const user = USERS[userIndex + 1];
    const completedCount = Math.min(lessonRows.length, Math.floor(user.xp / 300));
    completedByUser.set(userId, completedCount);
    for (let i = 0; i < completedCount; i += 1) {
      const lessonId = Number(lessonRows[i].id);
      const daysAgo = (i + userIndex * 2) % 14;
      progressRows.push([userId, lessonId, 'completed', 100, 1, dateAgo(daysAgo, 2), dateAgo(daysAgo, 0)]);
      activityRows.push([userId, 'lesson', String(lessonId), 1, dateAgo(daysAgo, 0)]);
      const questionIds = questionsByLesson.get(lessonId) ?? [];
      for (const [qIndex, questionId] of questionIds.slice(0, 2).entries()) {
        attemptRows.push([
          userId,
          questionId,
          qIndex === 0 ? 'Đáp án đúng' : 'Đáp án đã chọn',
          qIndex === 0 || userIndex % 4 !== 0 ? 1 : 0,
          dateAgo(daysAgo, qIndex),
        ]);
      }
    }
    const nextLesson = lessonRows[completedCount];
    if (nextLesson && user.xp > 0) {
      progressRows.push([userId, Number(nextLesson.id), 'in_progress', null, 1, dateAgo(1, 3), null]);
    }
  }
  await insertMany(
    'INSERT INTO progress (user_id, lesson_id, status, score, attempts, started_at, completed_at)',
    progressRows,
  );
  await insertMany(
    'INSERT INTO learning_answer_attempts (user_id, question_id, submitted_answer, is_correct, created_at)',
    attemptRows,
  );
  await insertMany(
    'INSERT INTO activity_events (user_id, kind, ref_id, amount, created_at)',
    activityRows,
  );

  // --- Video progress + saved words ---------------------------------------
  const videoProgressRows = [];
  const savedWordRows = [];
  for (const [index, userId] of learners.entries()) {
    const user = USERS[index + 1];
    const videoCount = Math.min(newVideoIds.length, Math.floor(user.xp / 1800));
    for (let i = 0; i < videoCount; i += 1) {
      const daysAgo = (index + i) % 12;
      videoProgressRows.push([
        userId,
        newVideoIds[i],
        Number(128 + i * 20),
        1,
        dateAgo(daysAgo, 1),
        dateAgo(daysAgo, 2),
        dateAgo(daysAgo, 0),
      ]);
      activityRows.push([userId, 'video', String(newVideoIds[i]), 1, dateAgo(daysAgo, 0)]);
    }
  }
  await insertMany(
    'INSERT INTO video_progress (user_id, video_id, watched_seconds, completed, completed_at, created_at, updated_at)',
    videoProgressRows,
  );
  const vocabEntries = [
    ['coworker', '/ˈkoʊˌwɜːrkər/', 'đồng nghiệp', 'Người cùng làm việc trong một công ty.'],
    ['sightseeing', '/ˈsaɪtsiːɪŋ/', 'đi tham quan', 'Đi thăm những điểm nổi tiếng.'],
    ['serendipity', '/ˌserənˈdɪpəti/', 'sự tình cờ may mắn', 'Điều tốt đẹp xảy ra tình cờ.'],
    ['resilient', '/rɪˈzɪliənt/', 'kiên cường', 'Có khả năng phục hồi sau khó khăn.'],
    ['curious', '/ˈkjʊriəs/', 'tò mò', 'Muốn biết nhiều hơn về điều gì đó.'],
  ];
  for (const [index, userId] of topUserIds.entries()) {
    for (const [wordIndex, entry] of vocabEntries.entries()) {
      if ((index + wordIndex) % 3 === 0) {
        savedWordRows.push([
          userId,
          newVideoIds[index % newVideoIds.length],
          entry[0],
          entry[1],
          entry[2],
          entry[3],
          dateAgo((index + wordIndex) % 8, 0),
        ]);
      }
    }
  }
  await insertMany(
    'INSERT INTO saved_words (user_id, video_id, word, ipa, meaning_vi, detail_vi, created_at)',
    savedWordRows,
  );

  // --- Matches / arena -----------------------------------------------------
  const matchRows = [];
  const matchActivityRows = [];
  const winsByUser = new Map(learners.map((id) => [id, 0]));
  for (let i = 0; i < 72; i += 1) {
    const p1 = learners[i % learners.length];
    const p2 = learners[(i * 3 + 1) % learners.length];
    if (p1 === p2) continue;
    const winner = i % 2 === 0 ? p1 : p2;
    const daysAgo = i % 14;
    matchRows.push([p1, p2, 1, 'completed', winner, dateAgo(daysAgo, 1), dateAgo(daysAgo, 0), dateAgo(daysAgo, 0)]);
    winsByUser.set(winner, (winsByUser.get(winner) ?? 0) + 1);
  }
  await insertMany(
    'INSERT INTO matches (player_one_id, player_two_id, stage_id, status, winner_user_id, started_at, completed_at, finished_at, created_at)',
    matchRows.map((row) => [...row, row[7]]),
  );
  const [matchIdRows] = await connection.query('SELECT id, player_one_id, player_two_id, winner_user_id, completed_at FROM matches ORDER BY id');
  for (const match of matchIdRows) {
    const ref = String(match.id);
    matchActivityRows.push([match.player_one_id, 'duel_play', ref, 1, match.completed_at]);
    matchActivityRows.push([match.player_two_id, 'duel_play', ref, 1, match.completed_at]);
    if (match.winner_user_id) {
      matchActivityRows.push([match.winner_user_id, 'duel_win', ref, 1, match.completed_at]);
    }
  }
  await insertMany(
    'INSERT INTO activity_events (user_id, kind, ref_id, amount, created_at)',
    matchActivityRows,
  );

  // --- Season standings ----------------------------------------------------
  const [[activeSeason]] = await connection.query(
    "SELECT id FROM seasons WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1",
  );
  if (activeSeason) {
    const standingRows = [];
    for (const [index, userId] of learners.entries()) {
      const user = USERS[index + 1];
      const wins = winsByUser.get(userId) ?? 0;
      const points = Math.round(user.xp / 6) + wins * 25;
      const videos = Math.min(newVideoIds.length, Math.floor(user.xp / 1800));
      const tier = tierFor(points);
      // Keep the persistent tier and the weekly snapshot in sync; otherwise the
      // header (users.league_tier) and the rows (season_standings.tier) disagree.
      await connection.execute('UPDATE users SET league_tier = ? WHERE id = ?', [tier, userId]);
      standingRows.push([
        activeSeason.id,
        userId,
        points,
        completedByUser.get(userId) ?? 0,
        videos,
        wins,
        tier,
      ]);
    }
    await insertMany(
      'INSERT INTO season_standings (season_id, user_id, race_points, lessons, videos, duel_wins, tier)',
      standingRows,
    );
  }

  // --- Badges --------------------------------------------------------------
  const [badgeRows] = await connection.query('SELECT id, code FROM badges');
  const badgeByCode = new Map(badgeRows.map((row) => [row.code, Number(row.id)]));
  const badgeAssignments = [];
  for (const [index, userId] of learners.entries()) {
    const user = USERS[index + 1];
    const completed = completedByUser.get(userId) ?? 0;
    if (completed >= 1) badgeAssignments.push([userId, badgeByCode.get('first_lesson')]);
    if (completed >= 10) badgeAssignments.push([userId, badgeByCode.get('lessons_10')]);
    if (user.xp >= 100) badgeAssignments.push([userId, badgeByCode.get('xp_100')]);
    if (user.xp >= 500) badgeAssignments.push([userId, badgeByCode.get('xp_500')]);
  }
  await insertMany(
    'INSERT IGNORE INTO user_badges (user_id, badge_id, awarded_at)',
    badgeAssignments.map(([userId, badgeId], index) => [userId, badgeId, dateAgo(index % 12, 0)]),
  );

  // --- Shop ownership / equipment / boosters -------------------------------
  const [shopRows] = await connection.query('SELECT id, code FROM shop_items');
  const shopByCode = new Map(shopRows.map((row) => [row.code, Number(row.id)]));
  const outfitByIndex = [
    ['car_gold', 'frame_prism', 'nameplate_royal'],
    ['car_aurora', 'frame_violet', 'nameplate_sunset'],
    ['car_navy', 'frame_gold', 'nameplate_forest'],
    ['car_mint', 'frame_silver', 'nameplate_cyan'],
    ['car_sport_red', 'frame_bronze', 'nameplate_slate'],
  ];
  const inventoryRows = [];
  const equipmentRows = [];
  for (const [index, userId] of learners.entries()) {
    const outfit = outfitByIndex[index] ?? ['car_default', 'frame_default', 'nameplate_default'];
    for (const code of ['car_default', 'frame_default', 'nameplate_default', ...outfit]) {
      const itemId = shopByCode.get(code);
      if (itemId) inventoryRows.push([userId, itemId, dateAgo(index % 20, 0)]);
    }
    for (const [slot, code] of [['car', outfit[0]], ['frame', outfit[1]], ['nameplate', outfit[2]]]) {
      const itemId = shopByCode.get(code);
      if (itemId) equipmentRows.push([userId, slot, itemId]);
    }
  }
  await insertMany(
    'INSERT IGNORE INTO user_inventory (user_id, item_id, acquired_at)',
    inventoryRows,
  );
  await insertMany(
    'INSERT INTO user_equipment (user_id, slot, item_id)',
    equipmentRows,
  );
  const boosterRows = [];
  for (const [index, userId] of topUserIds.slice(0, 4).entries()) {
    const shieldId = shopByCode.get('booster_streak_shield');
    const xpId = shopByCode.get('booster_xp2');
    if (shieldId) boosterRows.push([userId, shieldId, 'streak_shield', 2 + (index % 3), null]);
    if (xpId && index < 2) boosterRows.push([userId, xpId, 'xp_multiplier', 0, `DATE_ADD(NOW(), INTERVAL 30 MINUTE)`]);
  }
  if (boosterRows.length) {
    await connection.query(
      `INSERT INTO user_boosters (user_id, item_id, kind, charges, expires_at) VALUES ${boosterRows
        .map((row) => `(?, ?, ?, ?, ${row[4] === null ? 'NULL' : row[4]})`)
        .join(',')}`,
      boosterRows.flatMap((row) => [row[0], row[1], row[2], row[3]]),
    );
  }

  // --- Social identities --------------------------------------------------
  await connection.query(
    `INSERT INTO user_providers (user_id, provider, provider_user_id, email, display_name, avatar_url, linked_at, last_login_at)
     VALUES (?, 'google', 'demo-google-minhanh', ?, ?, NULL, ?, ?),
            (?, 'facebook', 'demo-facebook-hoangnam', ?, ?, NULL, ?, ?)`,
    [
      topUserIds[0], USERS[1].email, USERS[1].name, dateAgo(30, 0), dateAgo(1, 0),
      topUserIds[1], USERS[2].email, USERS[2].name, dateAgo(20, 0), dateAgo(2, 0),
    ],
  );

  // --- Chats, translations, reminders, ledger ------------------------------
  for (const [index, [topic, title, messages]] of CHAT_CONTENT.entries()) {
    const userId = topUserIds[index % topUserIds.length];
    const [chatResult] = await connection.execute(
      'INSERT INTO chats (user_id, topic, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, topic, title, dateAgo(index + 1, 0), dateAgo(index, 0)],
    );
    await insertMany(
      'INSERT INTO messages (chat_id, role, content, created_at)',
      messages.map(([role, content], messageIndex) => [
        chatResult.insertId,
        role,
        content,
        dateAgo(index, messages.length - messageIndex),
      ]),
    );
  }
  await insertMany(
    'INSERT INTO translations (user_id, file_name, original_text, source_language, translated_text, target_language, provider, created_at)',
    TRANSLATION_SAMPLES.map(([original, translated], index) => [
      topUserIds[index % topUserIds.length],
      index % 3 === 0 ? 'notes.txt' : null,
      original,
      'en',
      translated,
      'vi',
      'demo',
      dateAgo(index % 12, 0),
    ]),
  );
  await insertMany(
    'INSERT INTO study_reminders (user_id, title, body, due_at, target_json, created_at)',
    [
      [topUserIds[0], 'Ôn 20 từ vựng', 'Dành 10 phút ôn lại sổ từ trước khi học bài mới.', dateIn(2), '"vocabulary"', dateAgo(0, 0)],
      [topUserIds[0], 'Luyện nghe buổi tối', 'Nghe lại Counting Stars và gõ 5 câu đầu.', dateIn(24), '"video"', dateAgo(1, 0)],
      [topUserIds[1], 'Giữ chuỗi 22 ngày', 'Học một bài ngắn để giữ chuỗi hôm nay.', dateIn(4), '"lesson"', dateAgo(0, 0)],
    ].map((row) => row),
  );
  await insertMany(
    'INSERT INTO economy_ledger (user_id, currency, amount, source_type, source_id, created_at)',
    topUserIds.slice(0, 6).flatMap((userId, index) => [
      [userId, 'rc', 20 + index * 5, 'demo_seed', `demo-rc-${index}`, dateAgo(index, 0)],
      [userId, 'xp', 10 + index * 2, 'demo_seed', `demo-xp-${index}`, dateAgo(index, 0)],
    ]),
  );

  await connection.commit();
  console.log('Demo data seeded successfully.');
  console.log(JSON.stringify({
    users: USERS.length,
    adminId,
    learnerCount: learners.length,
    videos: newVideoIds.length,
    personalVideoId,
    lessons: lessonRows.length,
    progressRows: progressRows.length,
    answerAttempts: attemptRows.length,
    matches: matchRows.length,
    activeSeason: activeSeason?.id ?? null,
  }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error('Demo seed failed; transaction rolled back.');
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
