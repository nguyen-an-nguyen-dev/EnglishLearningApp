import { HttpError } from '../../middleware/error-handler';
import * as repository from './battle.repository';
import type { BattleWord } from './battle.repository';

export const PRACTICE_COUNT = 12;
export const PRACTICE_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
const ALLOWED_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export interface PracticeQuestion {
  id: number;
  answer: string;
  translation: string;
  part_of_speech: string;
  cefr_level: string;
  example: string;
  example_vi: string;
  image_url: string | null;
  options: string[];
}

export interface BattleSummary {
  played: number;
  wins: number;
  losses: number;
  win_rate: number;
  win_streak: number;
  last_played_at: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function maskExample(example: string, word: string): string {
  const pattern = new RegExp(`\\b${escapeForRegExp(word)}(?:s|es|d|ed|ing|ly|er|ers|est)?\\b`, 'gi');
  return example.replace(pattern, (match) => '•'.repeat(match.length));
}

export function buildPracticeQuestions(words: BattleWord[], count: number): PracticeQuestion[] {
  const unique = [...new Map(words.map((word) => [word.word.toLowerCase(), word])).values()];
  if (unique.length < 4) {
    throw new HttpError(503, 'The vocabulary bank is too small for practice mode.');
  }

  const targets = shuffle(unique).slice(0, Math.min(count, unique.length));
  return targets.map((word) => {
    const distractors = shuffle(unique.filter((candidate) => candidate.word !== word.word))
      .slice(0, 3)
      .map((candidate) => candidate.word);
    return {
      id: word.id,
      answer: word.word,
      translation: word.translation,
      part_of_speech: word.partOfSpeech,
      cefr_level: word.cefrLevel,
      example: maskExample(word.exampleEn, word.word),
      example_vi: word.exampleVi,
      image_url: word.imageUrl,
      options: shuffle([word.word, ...distractors]),
    };
  });
}

export function parsePracticeCount(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || raw === '') return PRACTICE_COUNT;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 4 || count > 20) {
    throw new HttpError(400, 'count must be an integer between 4 and 20.');
  }
  return count;
}

export function parsePracticeLevels(value: unknown): string[] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.trim() === '') return [...PRACTICE_LEVELS];
  const levels = raw
    .split(',')
    .map((level) => level.trim().toUpperCase())
    .filter(Boolean);
  if (levels.length === 0 || levels.some((level) => !ALLOWED_LEVELS.has(level))) {
    throw new HttpError(400, 'levels must be a comma-separated list of CEFR levels.');
  }
  return [...new Set(levels)];
}

export async function getPracticeQuestions(count: number, levels: string[]): Promise<PracticeQuestion[]> {
  const words = await repository.getWords(count * 4, levels);
  return buildPracticeQuestions(words, count);
}

export async function getBattleSummary(userId: number): Promise<BattleSummary> {
  const summary = await repository.getMatchSummary(userId);
  const losses = Math.max(0, summary.played - summary.wins);
  return {
    played: summary.played,
    wins: summary.wins,
    losses,
    win_rate: summary.played > 0 ? Math.round((summary.wins / summary.played) * 100) : 0,
    win_streak: summary.winStreak,
    last_played_at: summary.lastPlayedAt ? summary.lastPlayedAt.toISOString() : null,
  };
}
