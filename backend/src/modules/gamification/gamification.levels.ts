// Career level curve. Level is always derived from `users.xp`; nothing stores it,
// so a second copy can never drift out of sync. Thresholds are cumulative XP
// required to reach the level, so LEVEL_THRESHOLDS[0] is level 1 at 0 XP.
export const LEVEL_THRESHOLDS = [0, 60, 160, 320, 540, 820, 1160, 1560, 2020, 2540] as const;

export interface LevelProgress {
  level: number;
  /** Total XP the learner has. */
  xp: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP the current level spans (0 for the final level). */
  xpForLevel: number;
  /** XP still needed for the next level, null at max level. */
  xpToNextLevel: number | null;
  progressRatio: number;
}

export function levelForXp(xp: number): number {
  const value = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 1;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (value >= LEVEL_THRESHOLDS[index]) level = index + 1;
    else break;
  }
  return level;
}

export function levelProgress(xp: number): LevelProgress {
  const value = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  const level = levelForXp(value);
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const ceiling = LEVEL_THRESHOLDS[level];

  if (ceiling === undefined) {
    return {
      level,
      xp: value,
      xpIntoLevel: value - floor,
      xpForLevel: 0,
      xpToNextLevel: null,
      progressRatio: 1,
    };
  }

  const xpForLevel = ceiling - floor;
  const xpIntoLevel = value - floor;
  return {
    level,
    xp: value,
    xpIntoLevel,
    xpForLevel,
    xpToNextLevel: Math.max(0, xpForLevel - xpIntoLevel),
    progressRatio: xpForLevel > 0 ? Math.min(1, xpIntoLevel / xpForLevel) : 0,
  };
}
