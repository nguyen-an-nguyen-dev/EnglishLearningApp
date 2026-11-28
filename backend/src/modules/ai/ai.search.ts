import { normalizeDestination } from './ai.language';
import { wholeNumber } from './ai.time';

interface CatalogText {
  title: string;
  topic: string;
  stageTitle?: string;
  level?: string;
  completed?: boolean;
}

const TOPIC_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:thi )?qua khu don\b|\bsimple past\b/g, 'past simple'],
  [/\b(?:thi )?qua khu tiep dien\b/g, 'past continuous'],
  [/\b(?:thi )?hien tai don\b|\bsimple present\b/g, 'present simple'],
  [/\b(?:thi )?hien tai tiep dien\b/g, 'present continuous'],
  [/\b(?:thi )?hien tai hoan thanh\b/g, 'present perfect'],
  [/\bdong tu bat quy tac\b/g, 'irregular verbs'],
  [/\b(?:di sieu thi|mua sam o sieu thi|supermarket shopping)\b/g, 'grocery shopping'],
  [/\bphong van(?: xin viec)?\b/g, 'job interview'],
  [/\bgioi thieu ban than\b/g, 'introductions'],
  [/\bchao hoi\b/g, 'greetings'],
  [/\bdu lich\b/g, 'travel'],
  [/\bsan bay\b/g, 'airport'],
  [/\bkhach san\b/g, 'hotel'],
  [/\b(?:goi mon|dat mon)\b/g, 'ordering food'],
  [/\b(?:mua sam|hoi gia)\b/g, 'shopping'],
];

const NOISE = new Set([
  'a', 'an', 'the', 'to', 'of', 'on', 'about', 'for', 'with', 'and', 'or', 'at', 'in',
  'me', 'my', 'open', 'find', 'show', 'watch', 'play', 'give', 'recommend', 'suggest',
  'please', 'some', 'what', 'would', 'want', 'video', 'videos', 'clip', 'clips',
  'lesson', 'lessons', 'topic', 'study', 'learn', 'next',
  've', 'cho', 'minh', 'toi', 'ban', 'muon', 'mo', 'tim', 'xem', 'giup', 'vui', 'long',
  'hay', 'mot', 'nhung', 'cac', 'bai', 'hoc', 'nao', 'chu', 'de', 'trang', 'goi', 'y',
  'nhe', 'voi', 'duoc', 'khong',
]);

function catalogKey(text: string): string {
  return TOPIC_ALIASES.reduce((key, [pattern, canonical]) => key.replace(pattern, canonical), normalizeDestination(text));
}

const VIDEO_DURATION_WORDS = /\b(?:under|less than|at most|up to|no more than|no longer than|at least|longer than|over|more than|duoi|it hon|khong qua|toi da|toi thieu|tren|dai hon)\b/u;

export function hasVideoDurationLimit(text: string): boolean {
  return VIDEO_DURATION_WORDS.test(text) && /\b(?:minutes?|mins?|seconds?|secs?|phut|giay)\b/u.test(text);
}

/** Recognize a trailing maximum for one topic. Preserve other qualifiers for the coach. */
export function videoCatalogueQuery(query: string): { topic: string; maxSeconds?: number } | null {
  const text = normalizeDestination(query);
  if (!hasVideoDurationLimit(text)) return { topic: text };
  const limit = /^(.*?) (under|less than|at most|up to|no more than|no longer than|duoi|it hon|khong qua|toi da) (\d{1,4}|(?:[a-z]+ ){0,2}[a-z]+) (minutes?|mins?|seconds?|secs?|phut|giay)$/u.exec(text);
  if (!limit || /\b(?:not|no|khong|or|hoac)$/u.test(limit[1])) return null;
  const amount = wholeNumber(limit[3]);
  if (amount === undefined || amount < 1) return null;
  const seconds = amount * (/^(?:m|phut)/u.test(limit[4]) ? 60 : 1);
  const strict = /^(?:under|less than|duoi|it hon)$/u.test(limit[2]);
  return { topic: limit[1], maxSeconds: seconds - Number(strict) };
}

export function withinVideoDuration(item: { durationSeconds?: number }, maxSeconds: number | undefined): boolean {
  return maxSeconds === undefined || (item.durationSeconds !== undefined && item.durationSeconds > 0 && item.durationSeconds <= maxSeconds);
}

/** Exact title or topic, with an optional CEFR constraint at either end. */
export function exactCatalogueMatches<T extends CatalogText>(query: string, entries: readonly T[]): T[] {
  const key = catalogKey(query);
  const level = /^(?:([abc][12]) )|(?: ([abc][12]))$/u.exec(key);
  const term = level ? key.replace(level[0], '') : key;
  const requestedLevel = level?.[1] ?? level?.[2];
  if (!term) return [];
  const scoped = requestedLevel ? entries.filter((item) => item.level?.toLowerCase() === requestedLevel) : entries;
  const exactTitles = scoped.filter((item) => catalogKey(item.title) === term);
  return exactTitles.length ? exactTitles : scoped.filter((item) => catalogKey(item.topic) === term);
}

function terms(key: string): string[] {
  return key.split(' ').filter((word) => word.length > 1 && !NOISE.has(word) && !/^[abc][12]$/.test(word));
}

function hasPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * Require all meaningful terms for short queries. Whole titles and phrases
 * outrank scattered matches, and substrings never stand in for whole words.
 */
export function rankCatalog<T extends CatalogText>(query: string, entries: readonly T[]) {
  const key = catalogKey(query);
  const level = /\b([abc][12])\b/.exec(key)?.[1];
  const queryTerms = terms(key);
  const phrase = queryTerms.join(' ');
  const requested = [...new Set(queryTerms)];
  if (!requested.length) return [];
  const minimum = requested.length <= 3 ? requested.length : Math.ceil(requested.length * 0.75);
  const hasLevels = level && entries.some((entry) => entry.level);

  return entries.flatMap((item) => {
    if (hasLevels && item.level?.toLowerCase() !== level) return [];
    const title = terms(catalogKey(item.title)).join(' ');
    const topic = terms(catalogKey(item.topic)).join(' ');
    const stage = terms(catalogKey(item.stageTitle ?? '')).join(' ');
    const titleTerms = new Set(terms(title));
    const topicTerms = new Set(terms(topic));
    const stageTerms = new Set(terms(stage));
    const matched = requested.filter((word) => titleTerms.has(word) || topicTerms.has(word) || stageTerms.has(word));
    if (matched.length < minimum) return [];
    const weight = matched.reduce((score, word) =>
      score + (titleTerms.has(word) ? 6 : topicTerms.has(word) ? 4 : 1), 0);
    const phraseWeight = title === phrase ? 240 : topic === phrase ? 180
      : hasPhrase(title, phrase) ? 120 : hasPhrase(topic, phrase) ? 90 : 0;
    return [{ item, score: phraseWeight + weight }];
  }).sort((a, b) => b.score - a.score || Number(Boolean(a.item.completed)) - Number(Boolean(b.item.completed)));
}
