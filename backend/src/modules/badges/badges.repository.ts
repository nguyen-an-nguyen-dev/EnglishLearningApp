import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../db/pool';
import type { Badge, EarnedBadge } from './badges.types';

interface BadgeRow extends RowDataPacket, Badge {
  id: number;
}

interface EarnedBadgeRow extends RowDataPacket, EarnedBadge {}

export async function awardEligibleBadges(
  connection: PoolConnection,
  userId: number,
  completedLessons: number,
  totalXp: number,
): Promise<Badge[]> {
  const eligibleCodes: string[] = [];
  if (completedLessons >= 1) eligibleCodes.push('first_lesson');
  if (completedLessons >= 10) eligibleCodes.push('lessons_10');
  if (totalXp >= 100) eligibleCodes.push('xp_100');
  if (totalXp >= 500) eligibleCodes.push('xp_500');
  if (eligibleCodes.length === 0) return [];

  const placeholders = eligibleCodes.map(() => '?').join(', ');
  const [badgeRows] = await connection.execute<BadgeRow[]>(
    `SELECT id, code, name, description, icon
     FROM badges WHERE code IN (${placeholders})`,
    eligibleCodes,
  );

  const newlyAwarded: Badge[] = [];
  for (const badge of badgeRows) {
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)',
      [userId, badge.id],
    );
    if (result.affectedRows > 0) {
      newlyAwarded.push({
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
      });
    }
  }

  return newlyAwarded;
}

export async function getEarnedBadges(userId: number): Promise<EarnedBadge[]> {
  const [rows] = await pool.execute<EarnedBadgeRow[]>(
    `SELECT b.code, b.name, b.description, b.icon, ub.awarded_at
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = ?
     ORDER BY ub.awarded_at DESC, b.code ASC`,
    [userId],
  );
  return rows;
}