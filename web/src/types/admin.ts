import type { StageThemeKey } from '../roadmap'

export type MoveDirection = 'up' | 'down'

export const QUESTION_TYPES = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
  'word_order',
  'listening',
  'speaking',
] as const
export type AdminQuestionType = (typeof QUESTION_TYPES)[number]

export const CHOICE_QUESTION_TYPES: readonly AdminQuestionType[] = [
  'multiple_choice',
  'fill_choice',
  'listen_choice',
]
export const AUDIO_QUESTION_TYPES: readonly AdminQuestionType[] = ['listening', 'listen_choice']

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type AdminDifficulty = (typeof DIFFICULTIES)[number]

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const STAGE_THEME_KEYS = ['forest', 'river', 'autumn', 'alpine', 'coast', 'sakura'] as const
export type AdminStageTheme = Extract<StageThemeKey, (typeof STAGE_THEME_KEYS)[number]>

export const MAX_ANSWERS = 8
export const MIN_CHOICE_ANSWERS = 2

export interface AdminLessonSummary {
  id: number
  stage_id: number
  code: string
  title: string
  topic: string
  sort_order: number
  question_count: number
}

export interface AdminStage {
  id: number
  code: string
  title: string
  description: string | null
  theme_key: string
  accent_color: string
  sort_order: number
  lesson_count: number
  question_count: number
  lessons: AdminLessonSummary[]
}

export interface AdminAnswer {
  id: number
  answer_text: string
  is_correct: boolean
  sort_order: number
}

export interface AdminQuestion {
  id: number
  lesson_id: number
  question_text: string
  question_type: string
  explanation: string | null
  audio_url: string | null
  word_bank: string[]
  difficulty: string
  sort_order: number
  answers: AdminAnswer[]
}

export interface AdminSharedVideo {
  id: number
  code: string
  title: string
  description: string | null
  topic: string
  cefr_level: string
  provider: 'youtube' | 'file'
  video_url: string
  thumbnail_url: string | null
  duration_seconds: number
  xp_reward: number
  sort_order: number
  segment_count: number
  /** null while the video is a draft that learners cannot see. */
  published_at: string | null
  created_at: string
}

export interface AdminVideoSegment {
  id: number
  start_ms: number
  end_ms: number
  text_en: string
  text_vi: string | null
}

export interface AdminVideoSegmentPayload {
  start_ms: number
  end_ms: number
  text_en: string
}

export interface AdminVideoSegmentsResult {
  video: AdminSharedVideo
  segments: AdminVideoSegment[]
}

export interface StagePatchPayload {
  title?: string
  description?: string
  theme_key?: AdminStageTheme
}

export interface LessonPayload {
  stage_id: number
  title: string
  topic: string
}

export interface LessonPatchPayload {
  title?: string
  topic?: string
  stage_id?: number
}

export interface AdminAnswerPayload {
  answer_text: string
  is_correct: boolean
}

export interface QuestionPayload {
  question_text: string
  question_type: AdminQuestionType
  explanation?: string
  audio_url?: string | null
  word_bank?: string[]
  difficulty?: AdminDifficulty
  answers: AdminAnswerPayload[]
}

export interface QuestionPatchPayload extends Partial<Omit<QuestionPayload, 'answers'>> {
  answers?: AdminAnswerPayload[]
}

export interface SharedVideoPatchPayload {
  title?: string
  description?: string
  topic?: string
  cefr_level?: CefrLevel
  xp_reward?: number
}

export type SharedVideoImportResult = AdminSharedVideo

export const SHOP_SLOTS = ['car', 'frame', 'nameplate', 'booster'] as const
export type AdminShopSlot = (typeof SHOP_SLOTS)[number]

export const SHOP_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type AdminShopRarity = (typeof SHOP_RARITIES)[number]

export const SHOP_UNLOCK_TYPES = ['default', 'level', 'stage', 'league', 'achievement'] as const
export type AdminShopUnlockType = (typeof SHOP_UNLOCK_TYPES)[number]

export const BOOSTER_KINDS = ['streak_shield', 'xp_multiplier', 'rc_multiplier'] as const
export type AdminBoosterKind = (typeof BOOSTER_KINDS)[number]


export interface AdminShopItem {
  id: number
  code: string
  name: string
  description: string
  slot: AdminShopSlot
  rarity: AdminShopRarity
  price: number
  unlock_type: AdminShopUnlockType
  unlock_value: string | null
  visual_key: string
  style: Record<string, string | null> | null
  booster_kind: AdminBoosterKind | null
  booster_charges: number
  booster_duration_minutes: number
  sort_order: number
  active: boolean
  created_at: string
}

export interface ShopItemPayload {
  name: string
  description?: string
  slot: AdminShopSlot
  rarity: AdminShopRarity
  price: number
  unlock_type: AdminShopUnlockType
  unlock_value?: string | null
  visual_key?: string
  style?: Record<string, string | null> | null
  booster_kind?: AdminBoosterKind | null
  booster_charges?: number
  booster_duration_minutes?: number
  active?: boolean
}

export type ShopItemPatchPayload = Partial<Omit<ShopItemPayload, 'name'>> & { name?: string }

export const BATTLE_PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
] as const
export type AdminBattlePart = (typeof BATTLE_PARTS_OF_SPEECH)[number]

export interface AdminBattleWord {
  id: number
  word_en: string
  translation_vi: string
  part_of_speech: AdminBattlePart
  cefr_level: CefrLevel
  explanation_vi: string
  example_en: string
  example_vi: string
  image_url: string | null
  sort_order: number
}

export interface BattleWordPayload {
  word_en: string
  translation_vi: string
  part_of_speech: AdminBattlePart
  cefr_level: CefrLevel
  explanation_vi: string
  example_en: string
  example_vi: string
  image_url?: string | null
}

export type BattleWordPatchPayload = Partial<BattleWordPayload>

export interface AdminVideoVocabulary {
  id: number
  video_id: number
  word: string
  ipa: string
  meaning_vi: string
  detail_vi: string
  sort_order: number
}

export interface VideoVocabularyPayload {
  word: string
  ipa?: string
  meaning_vi: string
  detail_vi: string
}

export type VideoVocabularyPatchPayload = Partial<VideoVocabularyPayload>

export type AdminManagedRole = 'learner' | 'admin'

export interface AdminManagedUser {
  id: number
  name: string
  email: string
  role: AdminManagedRole
  xp: number
  coins: number
  level: number
  streak: number
  streak_lost: number
  streak_lost_at: string | null
  race_points: number
  lessons_completed: number
  videos_completed: number
  provider_count: number
  created_at: string
  last_activity_at: string | null
}

export interface AdminUserListResult {
  users: AdminManagedUser[]
  total: number
  limit: number
  offset: number
}

export interface AdminUserPatchPayload {
  xp?: number
  coins?: number
  streak?: number
  race_points?: number
  role?: AdminManagedRole
}

export interface AdminStatsOverview {
  totalLearners: number
  totalAdmins: number
  newToday: number
  newYesterday: number
  newThisWeek: number
  newThisMonth: number
  activeToday: number
  activeYesterday: number
  active7d: number
  active30d: number
  inactive7d: number
  inactive14d: number
  inactive30d: number
  neverActive: number
  returningToday: number
  retentionTodayVsYesterdayPct: number | null
  avgXp: number
  totalXp: number
  avgStreak: number
  maxStreak: number
  lessonsCompletedTotal: number
  lessonsInProgressActive: number
  lessonCompletionRatePct: number
  videosSharedCount: number
  videosCompletedTotal: number
  videoCompletionRatePct: number
  matchesTotal: number
  matchesToday: number
  translationsTotal: number
  answersTotal: number
  answerCorrectRatePct: number
  savedWordsTotal: number
}

export interface AdminDayTrend {
  date: string
  newUsers: number
  activeUsers: number
  lessonsCompleted: number
  lessonsStarted: number
  videosCompleted: number
  attempts: number
  matchesStarted: number
  translations: number
}

export interface AdminStageStat {
  stageId: number
  stageTitle: string
  sortOrder: number
  lessonCount: number
  learnersStarted: number
  completions: number
  completionRatePct: number
  avgScore: number | null
}

export interface AdminLessonStat {
  lessonId: number
  stageId: number
  stageTitle: string
  title: string
  topic: string
  questionCount: number
  learnersStarted: number
  completions: number
  abandonRatePct: number
  avgScore: number | null
}

export interface AdminContentStats {
  stages: number
  lessons: number
  questions: number
  answers: number
  sharedVideos: number
  videoSegments: number
  personalVideos: number
  battleWords: number
  badges: number
  translationsTotal: number
  chatsTotal: number
}

export interface AdminInactiveUser {
  id: number
  displayName: string
  email: string
  xp: number
  streak: number
  createdAt: string
  lastActivityAt: string | null
  daysInactive: number
  lessonsCompleted: number
}
