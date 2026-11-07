import { HttpError } from '../../middleware/error-handler';
import { parseImportModel } from '../video/video.validation';
import {
  AUDIO_QUESTION_TYPES,
  CEFR_LEVELS,
  CHOICE_QUESTION_TYPES,
  DIFFICULTIES,
  QUESTION_TYPES,
  STAGE_THEME_KEYS,
  type AdminDifficulty,
  type AdminQuestionType,
  type CefrLevel,
  type LessonInput,
  type LessonPatch,
  type MoveDirection,
  type QuestionInput,
  type SharedVideoImportInput,
  type SharedVideoPatch,
  type StageInput,
  type StagePatch,
  type StageThemeKey,
} from './admin.types';

export const MAX_ANSWERS = 8;
export const MIN_CHOICE_ANSWERS = 2;

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveId(value: unknown, field: string): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, `Invalid ${field}.`);
  return id;
}

export const parseStageId = (value: unknown): number => positiveId(value, 'stage ID');
export const parseLessonId = (value: unknown): number => positiveId(value, 'lesson ID');
export const parseQuestionId = (value: unknown): number => positiveId(value, 'question ID');
export const parseVideoId = (value: unknown): number => positiveId(value, 'video ID');

function optionalText(
  raw: unknown,
  field: string,
  max: number,
  errors: string[],
): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    errors.push(`${field} must be a string.`);
    return undefined;
  }
  const value = raw.trim();
  if (value.length > max) errors.push(`${field} must be at most ${max} characters.`);
  return value;
}

function requiredText(
  raw: unknown,
  field: string,
  max: number,
  errors: string[],
): string | undefined {
  const value = optionalText(raw, field, max, errors);
  if (value === undefined) {
    errors.push(`${field} is required.`);
    return undefined;
  }
  if (value.length === 0) {
    errors.push(`${field} must not be empty.`);
    return undefined;
  }
  return value;
}

function parseTheme(raw: unknown, errors: string[]): StageThemeKey | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !(STAGE_THEME_KEYS as readonly string[]).includes(raw)) {
    errors.push(`theme_key must be one of ${STAGE_THEME_KEYS.join(', ')}.`);
    return undefined;
  }
  return raw as StageThemeKey;
}

export function parseStageInput(value: unknown): StageInput {
  const body = asObject(value);
  const errors: string[] = [];
  const title = requiredText(body.title, 'title', 120, errors);
  const description = optionalText(body.description, 'description', 500, errors);
  const themeKey = parseTheme(body.theme_key ?? body.themeKey, errors);
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { title: title as string, description: description ? description : null, themeKey };
}

export function parseStagePatch(value: unknown): StagePatch {
  const body = asObject(value);
  const errors: string[] = [];
  const title = body.title === undefined ? undefined : requiredText(body.title, 'title', 120, errors);
  const description = body.description === undefined
    ? undefined
    : optionalText(body.description, 'description', 500, errors);
  const themeKey = parseTheme(body.theme_key ?? body.themeKey, errors);
  if (title === undefined && description === undefined && themeKey === undefined) {
    errors.push('Provide at least one field to update.');
  }
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return {
    title,
    description: description === undefined ? undefined : (description ? description : null),
    themeKey,
  };
}

export function parseLessonInput(value: unknown): LessonInput {
  const body = asObject(value);
  const errors: string[] = [];
  const stageId = Number(body.stage_id ?? body.stageId);
  if (!Number.isInteger(stageId) || stageId < 1) errors.push('stage_id must be a positive integer.');
  const title = requiredText(body.title, 'title', 120, errors);
  const topic = requiredText(body.topic, 'topic', 120, errors);
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { stageId, title: title as string, topic: topic as string };
}

export function parseLessonPatch(value: unknown): LessonPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const title = body.title === undefined ? undefined : requiredText(body.title, 'title', 120, errors);
  const topic = body.topic === undefined ? undefined : requiredText(body.topic, 'topic', 120, errors);
  let stageId: number | undefined;
  if (body.stage_id !== undefined || body.stageId !== undefined) {
    const parsed = Number(body.stage_id ?? body.stageId);
    if (!Number.isInteger(parsed) || parsed < 1) errors.push('stage_id must be a positive integer.');
    else stageId = parsed;
  }
  if (title === undefined && topic === undefined && stageId === undefined) {
    errors.push('Provide at least one field to update.');
  }
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { title, topic, stageId };
}

/** `word_order`/`listening` tap mode needs tokens; a hand-typed bank may use commas or new lines. */
export function normalizeWordBank(value: unknown, fallbackAnswer?: string): string[] {
  const tokens = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : typeof value === 'string'
      ? value.split(/[,\n;]+/).map((entry) => entry.trim())
      : [];
  const cleaned = tokens.map((token) => token.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned.slice(0, 60);
  return buildWordBank(fallbackAnswer ?? '');
}

export function buildWordBank(answer: string): string[] {
  return answer
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 60);
}

interface ParsedAnswers {
  answers: QuestionInput['answers'];
}

function parseAnswers(
  raw: unknown,
  questionType: AdminQuestionType,
  errors: string[],
): ParsedAnswers {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push('answers must be a non-empty array.');
    return { answers: [] };
  }
  if (raw.length > MAX_ANSWERS) {
    errors.push(`A question can have at most ${MAX_ANSWERS} answers.`);
  }
  const answers: QuestionInput['answers'] = [];
  for (const [index, entry] of raw.entries()) {
    const item = asObject(entry);
    const answerText = typeof item.answer_text === 'string'
      ? item.answer_text.trim()
      : typeof item.answerText === 'string' ? item.answerText.trim() : '';
    if (!answerText) {
      errors.push(`answers[${index}].answer_text is required.`);
      continue;
    }
    if (answerText.length > 500) {
      errors.push(`answers[${index}].answer_text must be at most 500 characters.`);
      continue;
    }
    const isCorrect = item.is_correct === true
      || item.isCorrect === true
      || item.is_correct === 1
      || item.isCorrect === 1;
    answers.push({ answerText, isCorrect });
  }

  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  if (correctCount !== 1) {
    errors.push('answers must contain exactly one correct answer.');
  }
  if (CHOICE_QUESTION_TYPES.includes(questionType) && answers.length < MIN_CHOICE_ANSWERS) {
    errors.push(`Choice questions need at least ${MIN_CHOICE_ANSWERS} answers.`);
  }
  return { answers };
}

export function parseQuestionInput(value: unknown): QuestionInput {
  const body = asObject(value);
  const errors: string[] = [];

  const questionText = requiredText(body.question_text ?? body.questionText, 'question_text', 5000, errors);
  const rawType = body.question_type ?? body.questionType;
  let questionType: AdminQuestionType = 'multiple_choice';
  if (typeof rawType !== 'string' || !(QUESTION_TYPES as readonly string[]).includes(rawType)) {
    errors.push(`question_type must be one of ${QUESTION_TYPES.join(', ')}.`);
  } else {
    questionType = rawType as AdminQuestionType;
  }

  const explanation = optionalText(body.explanation, 'explanation', 2000, errors);
  const audioUrl = optionalText(body.audio_url ?? body.audioUrl, 'audio_url', 2048, errors);
  const rawDifficulty = body.difficulty;
  let difficulty: AdminDifficulty = 'beginner';
  if (rawDifficulty !== undefined && rawDifficulty !== null && rawDifficulty !== '') {
    if (typeof rawDifficulty !== 'string' || !(DIFFICULTIES as readonly string[]).includes(rawDifficulty)) {
      errors.push(`difficulty must be one of ${DIFFICULTIES.join(', ')}.`);
    } else {
      difficulty = rawDifficulty as AdminDifficulty;
    }
  }

  if (AUDIO_QUESTION_TYPES.includes(questionType) && !audioUrl) {
    errors.push('audio_url is required for listening questions.');
  }

  const { answers } = parseAnswers(body.answers, questionType, errors);

  const correctAnswer = answers.find((answer) => answer.isCorrect)?.answerText ?? '';
  const wordBank = normalizeWordBank(body.word_bank ?? body.wordBank, correctAnswer);

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  return {
    questionText: questionText as string,
    questionType,
    explanation: explanation ? explanation : null,
    audioUrl: audioUrl ? audioUrl : null,
    wordBank,
    difficulty,
    answers,
  };
}

/** Same contract as create, but every field is optional. */
export interface QuestionPatchInput {
  questionText?: string;
  questionType?: AdminQuestionType;
  explanation?: string | null;
  audioUrl?: string | null;
  wordBank?: string[];
  difficulty?: AdminDifficulty;
  answers?: QuestionInput['answers'];
}

export function parseQuestionPatch(value: unknown): QuestionPatchInput {
  const body = asObject(value);
  const errors: string[] = [];
  const patch: QuestionPatchInput = {};

  if (body.question_text !== undefined || body.questionText !== undefined) {
    patch.questionText = requiredText(body.question_text ?? body.questionText, 'question_text', 5000, errors);
  }
  if (body.question_type !== undefined || body.questionType !== undefined) {
    const rawType = body.question_type ?? body.questionType;
    if (typeof rawType !== 'string' || !(QUESTION_TYPES as readonly string[]).includes(rawType)) {
      errors.push(`question_type must be one of ${QUESTION_TYPES.join(', ')}.`);
    } else {
      patch.questionType = rawType as AdminQuestionType;
    }
  }
  if (body.explanation !== undefined) {
    patch.explanation = optionalText(body.explanation, 'explanation', 2000, errors) || null;
  }
  if (body.audio_url !== undefined || body.audioUrl !== undefined) {
    patch.audioUrl = optionalText(body.audio_url ?? body.audioUrl, 'audio_url', 2048, errors) || null;
  }
  if (body.difficulty !== undefined) {
    const rawDifficulty = body.difficulty;
    if (typeof rawDifficulty !== 'string' || !(DIFFICULTIES as readonly string[]).includes(rawDifficulty)) {
      errors.push(`difficulty must be one of ${DIFFICULTIES.join(', ')}.`);
    } else {
      patch.difficulty = rawDifficulty as AdminDifficulty;
    }
  }
  if (body.word_bank !== undefined || body.wordBank !== undefined) {
    patch.wordBank = normalizeWordBank(body.word_bank ?? body.wordBank);
  }
  if (body.answers !== undefined) {
    const type = patch.questionType ?? (typeof body.question_type === 'string'
      ? body.question_type as AdminQuestionType
      : 'multiple_choice');
    patch.answers = parseAnswers(body.answers, type, errors).answers;
  }

  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}

export function parseMoveDirection(value: unknown): MoveDirection {
  const body = asObject(value);
  if (body.direction === 'up' || body.direction === 'down') return body.direction;
  throw new HttpError(422, 'Validation failed', ['direction must be "up" or "down".']);
}

export function parseSharedVideoImport(value: unknown): SharedVideoImportInput {
  const body = asObject(value);
  const raw = body.url ?? body.youtubeUrl ?? body.youtube_url;
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url || url.length > 500) {
    throw new HttpError(422, 'Provide a valid YouTube link.', ['INVALID_YOUTUBE_URL']);
  }
  return { url, model: parseImportModel(body) };
}

export function parseSharedVideoPatch(value: unknown): SharedVideoPatch {
  const body = asObject(value);
  const errors: string[] = [];
  const patch: SharedVideoPatch = {};

  if (body.title !== undefined) patch.title = requiredText(body.title, 'title', 160, errors);
  if (body.description !== undefined) {
    patch.description = optionalText(body.description, 'description', 500, errors) || null;
  }
  if (body.topic !== undefined) patch.topic = requiredText(body.topic, 'topic', 100, errors);
  if (body.cefr_level !== undefined || body.cefrLevel !== undefined) {
    const rawLevel = body.cefr_level ?? body.cefrLevel;
    if (typeof rawLevel !== 'string' || !(CEFR_LEVELS as readonly string[]).includes(rawLevel)) {
      errors.push(`cefr_level must be one of ${CEFR_LEVELS.join(', ')}.`);
    } else {
      patch.cefrLevel = rawLevel as CefrLevel;
    }
  }
  if (body.xp_reward !== undefined || body.xpReward !== undefined) {
    const xp = Number(body.xp_reward ?? body.xpReward);
    if (!Number.isInteger(xp) || xp < 0 || xp > 100) {
      errors.push('xp_reward must be an integer between 0 and 100.');
    } else {
      patch.xpReward = xp;
    }
  }

  if (Object.keys(patch).length === 0) errors.push('Provide at least one field to update.');
  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return patch;
}

/**
 * URL-safe code fragment from a human title: Vietnamese diacritics folded to
 * ASCII, then anything that is not a letter or digit collapsed to one dash.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

/** `greetings`, then `greetings-2`, `greetings-3`… so unique codes never fail the insert. */
export function nextAvailableCode(base: string, taken: ReadonlySet<string>, fallback = 'item'): string {
  const root = (slugify(base) || fallback).slice(0, 46);
  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new HttpError(409, 'Too many items with the same name.', ['CODE_EXHAUSTED']);
}
