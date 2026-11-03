// Local development helper: creates a fully unlocked test account.
// Run from backend/: node database/create-test-account.mjs
import 'dotenv/config';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const EMAIL = 'test.full@engorace.dev';
const PASSWORD = 'Test123456';
const DISPLAY_NAME = 'Test Full';
const BASE_USERNAME = 'test_full_engorace';
const XP = 700;
const STREAK = 12;

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning',
  charset: 'utf8mb4',
});

try {
  const [existingUsers] = await connection.execute(
    'SELECT id, username FROM users WHERE email = ? LIMIT 1',
    [EMAIL],
  );
  const existing = existingUsers[0];

  const [usernameOwners] = await connection.execute(
    'SELECT id FROM users WHERE username = ? AND email <> ? LIMIT 1',
    [BASE_USERNAME, EMAIL],
  );
  const username = usernameOwners.length > 0
    ? `${BASE_USERNAME}_${Date.now().toString(36)}`
    : BASE_USERNAME;

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let userId;

  if (existing) {
    userId = existing.id;
    await connection.execute(
      `UPDATE users
       SET username = ?, password_hash = ?, display_name = ?, xp = ?, streak = ?
       WHERE id = ?`,
      [username, passwordHash, DISPLAY_NAME, XP, STREAK, userId],
    );
  } else {
    const [result] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, display_name, xp, streak)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, EMAIL, passwordHash, DISPLAY_NAME, XP, STREAK],
    );
    userId = result.insertId;
  }

  const [lessonRows] = await connection.query(
    `SELECT l.id
     FROM lessons l
     JOIN stages s ON s.id = l.stage_id
     ORDER BY s.sort_order, l.sort_order`,
  );

  const completedLessons = lessonRows.slice(0, -1);
  const unlockedLesson = lessonRows[lessonRows.length - 1];

  await connection.beginTransaction();
  try {
    await connection.execute('DELETE FROM progress WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_badges WHERE user_id = ?', [userId]);

    for (const lesson of completedLessons) {
      await connection.execute(
        `INSERT INTO progress
           (user_id, lesson_id, status, score, started_at, completed_at, updated_at)
         VALUES (?, ?, 'completed', 100, NOW(), NOW(), NOW())`,
        [userId, lesson.id],
      );
    }

    await connection.execute(
      `INSERT IGNORE INTO user_badges (user_id, badge_id)
       SELECT ?, id FROM badges`,
      [userId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }

  console.log(JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    displayName: DISPLAY_NAME,
    userId,
    completedLessons: completedLessons.length,
    unlockedLessonId: unlockedLesson?.id ?? null,
    totalLessons: lessonRows.length,
    xp: XP,
    streak: STREAK,
  }, null, 2));
} finally {
  await connection.end();
}
