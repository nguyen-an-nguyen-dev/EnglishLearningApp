import 'dotenv/config';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const TIERS = ['coal', 'copper', 'iron', 'gold', 'redstone', 'lapis', 'diamond'];
const NAMES = [
  ['Nguyễn Gia Bảo','Trần Khánh Vy','Lê Minh Khang','Phạm Ngọc Hà','Võ Đức Anh','Đặng Thảo Nhi','Bùi Quang Huy','Hoàng Mai Chi','Phan Tuấn Kiệt','Đỗ Bảo Ngọc'],
  ['Nguyễn Minh Anh','Lê Thu Hà','Trần Hoàng Nam','Đỗ Khánh Linh','Phạm Quốc Bảo','Vũ Gia Hân','Bùi Tuấn Kiệt','Ngô Bảo Châu','Đặng Minh Thư','Hoàng Anh Tuấn'],
  ['Lý Gia Bảo','Phan Thùy Dương','Tạ Quang Huy','Dương Khánh Vy','Mai Quốc Việt','Đinh Hải Yến','Lương Bảo Ngọc','Châu Minh Khôi','Huỳnh Thanh Tâm','Võ Thảo Nguyên'],
  ['Cao Đức Thịnh','Lâm Gia Huy','Nguyễn Thu Trang','Phùng Tuấn Anh','Kiều Diễm My','Trương Nhật Minh','Đặng Hoài An','Đỗ Phương Linh','Vũ Thành Đạt','Phạm Yến Nhi'],
  ['Nguyễn Hải Đăng','Trần Bảo Trân','Lê Hoàng Phúc','Phạm Thanh Tâm','Võ Ngọc Diệp','Đặng Quốc Khánh','Bùi Minh Châu','Hoàng Đức Long','Phan Quỳnh Anh','Đỗ Nhật Hào'],
  ['Lý Tuệ Minh','Phạm Gia Linh','Nguyễn Thành Công','Trần Mỹ Duyên','Lê Quang Vinh','Vũ Phương Thảo','Đặng Minh Đức','Bùi Khánh Ngân','Cao Hoàng Sơn','Ngô Tú Uyên'],
  ['Nguyễn Nhật Nam','Trần Ngọc Ánh','Lê Đức Minh','Phạm Khánh Hòa','Võ Thanh Bình','Đặng Bảo Long','Bùi Hải Yến','Hoàng Gia Phúc','Phan Minh Tâm','Đỗ Thùy Linh'],
];
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_learning', charset: 'utf8mb4',
});
try {
  const [[season]] = await conn.query("SELECT id FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1");
  if (!season) throw new Error('No active season exists; create one before seeding demo learners.');
  const hash = await bcrypt.hash('Engorace@2026', 12);
  await conn.beginTransaction();
  for (let ti = 0; ti < TIERS.length; ti += 1) {
    for (let rank = 0; rank < 10; rank += 1) {
      const tier = TIERS[ti];
      const username = `demo_${tier}_${String(rank + 1).padStart(2, '0')}`;
      const email = `${username}@engorace.demo`;
      const name = NAMES[ti][rank];
      const [[identityConflict]] = await conn.query(
        'SELECT username, email FROM users WHERE username=? OR email=? LIMIT 1', [username, email],
      );
      if (identityConflict && (identityConflict.username !== username || identityConflict.email !== email)) {
        throw new Error(`Demo identity conflict for ${username}; no existing account was modified.`);
      }
      const xp = Math.max(40, 250 + ti * 1650 + (9 - rank) * 137 + ((rank + ti) % 3) * 53);
      const coins = ((rank + 1) * 173 + ti * 241) % 2800;
      const streak = (rank * 7 + ti * 3) % 37;
      await conn.execute(
        `INSERT INTO users (username,email,password_hash,display_name,xp,coins,streak,last_activity_date,role,league_tier,password_set)
         VALUES (?,?,?,?,?,?,?,CURDATE(),'learner',?,1)
         ON DUPLICATE KEY UPDATE email=VALUES(email),display_name=VALUES(display_name),xp=VALUES(xp),coins=VALUES(coins),streak=VALUES(streak),last_activity_date=CURDATE(),role='learner',league_tier=VALUES(league_tier),password_set=1,avatar_url=NULL,avatar_public_id=NULL`,
        [username,email,hash,name,xp,coins,streak,tier],
      );
      const [[user]] = await conn.query('SELECT id FROM users WHERE username=?', [username]);
      const points = Math.max(180, 1530 - rank * 119 + ti * 13 + (rank % 3) * 7);
      await conn.execute(
        `INSERT INTO season_standings (season_id,user_id,race_points,lessons,videos,duel_wins,tier)
         VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE race_points=VALUES(race_points),lessons=VALUES(lessons),videos=VALUES(videos),duel_wins=VALUES(duel_wins),tier=VALUES(tier)`,
        [season.id,user.id,points,Math.floor(xp/300),Math.floor(xp/1800),rank%8,tier],
      );
      await conn.execute(
        `INSERT INTO user_providers (user_id,provider,provider_user_id,email,display_name,avatar_url)
         VALUES (?,'google',?,?,?,NULL) ON DUPLICATE KEY UPDATE email=VALUES(email),display_name=VALUES(display_name),avatar_url=NULL`,
        [user.id,username,email,name],
      );
    }
  }
  await conn.commit();
  console.log(`Upserted 70 demo learners across ${TIERS.length} tiers; other users and activity were preserved.`);
} catch (error) {
  await conn.rollback();
  console.error('Demo learner seed failed; transaction rolled back.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await conn.end();
}
