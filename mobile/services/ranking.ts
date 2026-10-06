import { request } from './api';

export interface RankingEntry {
  rank: number;
  userId: number;
  name: string;
  avatar: string | null;
  xp: number;
}

export interface RankingData {
  leaderboard: RankingEntry[];
  current_user_rank: number | null;
}

export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  awarded_at: string;
}

export async function fetchRanking(): Promise<RankingData> {
  return request<RankingData>('/ranking');
}

export async function fetchMyBadges(): Promise<EarnedBadge[]> {
  const data = await request<{ badges: EarnedBadge[] }>('/badges/me');
  return data.badges;
}