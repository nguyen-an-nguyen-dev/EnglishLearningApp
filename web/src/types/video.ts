export type VideoAnalysisModel = 'bolt' | 'gemini'

export interface VideoProgress {
  watched_seconds: number
  completed: boolean
  completed_at: string | null
}

export interface VideoVocabulary {
  id: number
  word: string
  ipa: string
  meaning_vi: string
  detail_vi: string
}

export interface VideoLessonSummary {
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
  is_owned: boolean
  progress: VideoProgress | null
}

export interface VideoSegment {
  id: number
  start_ms: number
  end_ms: number
  text_en: string
  text_vi: string | null
}

export interface VideoLessonDetail extends VideoLessonSummary {
  subtitle_en: string | null
  subtitle_vi: string | null
  vocabulary: VideoVocabulary[]
  segments: VideoSegment[]
}

export interface WordLookup {
  word: string
  translation: string
  phonetic: string
  partOfSpeech: string
  meaning: string
  example: string
}

export interface SavedWord {
  id: number
  video_id: number | null
  word: string
  ipa: string | null
  meaning_vi: string | null
  detail_vi: string | null
  created_at: string
}

export interface CompleteVideoResult {
  progress: VideoProgress
  completed: boolean
  already_completed: boolean
  xp_earned: number
  badges_awarded: Array<{ code: string; name: string; description: string; icon: string | null }>
}

export interface SaveWordPayload {
  word: string
  ipa?: string
  meaningVi?: string
  detailVi?: string
  videoId?: number
}

/** Public pre-signup preview: same lesson, trimmed to its first few segments. */
export interface DemoVideoSegment {
  id: number
  start_ms: number
  end_ms: number
  text_en: string
}

export interface DemoVideoVocabulary {
  word: string
  ipa: string
  meaning_vi: string
  detail_vi: string
}

export interface DemoVideo {
  id: number
  code: string
  title: string
  topic: string
  cefr_level: string
  provider: 'youtube' | 'file'
  video_url: string
  thumbnail_url: string | null
  duration_seconds: number
  demo_segment_limit: number
  total_segments: number
  segments: DemoVideoSegment[]
  vocabulary: DemoVideoVocabulary[]
}

export interface ArenaSummary {
  played: number
  wins: number
  losses: number
  win_rate: number
  win_streak: number
  last_played_at: string | null
}


export interface BattleOpponent {
  userId: number
  name: string
}

export interface BattleScore {
  userId: number
  name: string
  score: number
}

export interface BattleLetterHint {
  position: number
  letter: string
}

export interface BattleHintStep {
  atMs: number
  letters: BattleLetterHint[]
}

export interface BattleQuestion {
  matchId: number
  round: number
  totalRounds: number
  wordId: number
  translation: string
  partOfSpeech: string
  cefrLevel: string
  explanation: string
  example: string
  exampleVi: string
  letterCount: number
  letterHints: BattleLetterHint[]
  hintSchedule: BattleHintStep[]
  imageUrl: string | null
  durationMs: number
}

export interface BattleStart {
  matchId: number
  players: BattleOpponent[]
  totalRounds: number
  roundDurationMs: number
}

export interface BattleAnswerResult {
  matchId: number
  round: number
  correct: false
  responseTimeMs: number
}

export interface BattleRoundEnd {
  matchId: number
  round: number
  totalRounds: number
  wordId: number
  answer: string
  example: string
  winnerUserId: number | null
  timedOut: boolean
  scores: BattleScore[]
}

export interface BattleFinish {
  matchId: number
  status: 'completed' | 'cancelled'
  winnerUserId: number | null
  scores: BattleScore[]
  totalRounds: number
  reason?: 'opponent_disconnected' | 'left' | 'server_error'
}

export interface BattleResume {
  matchId: number
  game: BattleStart
  opponent: BattleOpponent
  question: BattleQuestion | null
  roundEnd: BattleRoundEnd | null
  scores: BattleScore[]
  remainingMs: number
}
