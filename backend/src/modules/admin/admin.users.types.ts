import type { RowDataPacket } from 'mysql2';

export type AdminManagedRole = 'learner' | 'admin';

export interface AdminUserRow extends RowDataPacket {
  id: number;
  display_name: string;
  email: string;
  role: AdminManagedRole;
  xp: number;
  coins: number;
  streak: number;
  streak_lost: number;
  streak_lost_at: Date | null;
  created_at: Date;
  last_activity_at: Date | null;
  lessons_completed: number;
  videos_completed: number;
  race_points: number;
  provider_count: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminManagedRole;
  xp: number;
  coins: number;
  level: number;
  streak: number;
  streak_lost: number;
  streak_lost_at: string | null;
  race_points: number;
  lessons_completed: number;
  videos_completed: number;
  provider_count: number;
  created_at: string;
  last_activity_at: string | null;
}

export interface AdminUserListQuery {
  search: string;
  role: AdminManagedRole | null;
  limit: number;
  offset: number;
}

export interface AdminUserPatch {
  xp?: number;
  coins?: number;
  streak?: number;
  racePoints?: number;
  role?: AdminManagedRole;
}
