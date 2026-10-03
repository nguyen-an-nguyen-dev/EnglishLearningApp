export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string | null;
}

export interface EarnedBadge extends Badge {
  awarded_at: Date;
}