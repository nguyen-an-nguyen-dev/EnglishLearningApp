import type { RankingEntry } from '../types/community'

/** How many leaders and how many tail learners the league view shows. */
export const BOARD_PREVIEW_SIZE = 6

export interface BoardPreview {
  /** The first six learners (the promotion zone), best first. */
  top: RankingEntry[]
  /** The last six learners (the demotion zone), best first. */
  bottom: RankingEntry[]
  /** Learners hidden between the two visible blocks. */
  hiddenCount: number
  /** The signed-in learner's row, wherever it is on the board. */
  me: RankingEntry | null
  /** True when the signed-in learner sits in the hidden middle. */
  meInMiddle: boolean
}

/**
 * Reduce a full league board to the two blocks the learner actually needs to
 * see: the six people they can climb past and the six they must stay ahead of.
 * Small boards are shown in full (never duplicated), and the middle is counted
 * so the UI can draw one quiet separator instead of a wall of strangers.
 */
export function previewBoard(entries: RankingEntry[], myUserId?: number): BoardPreview {
  const total = entries.length
  const size = BOARD_PREVIEW_SIZE
  const top = entries.slice(0, Math.min(size, total))
  // A large board isolates the two blocks. A small board simply shows every
  // row once, split into a top and a bottom part with no gap in between.
  const bottomStart = Math.max(size, total - size)
  const bottom = entries.slice(bottomStart)
  const hiddenCount = Math.max(0, total - top.length - bottom.length)
  const me = myUserId === undefined ? null : entries.find((entry) => entry.userId === myUserId) ?? null
  const meVisible = me !== null && [...top, ...bottom].some((entry) => entry.userId === myUserId)
  return { top, bottom, hiddenCount, me, meInMiddle: me !== null && !meVisible }
}
