import { normalizeDestination } from './ai.language';
import type { CoachMessageRow, MessageRow } from './ai.types';

export type DestinationSelection = 1 | 2 | 3 | 'last' | 'only';

const ORDINALS = new Map<string, DestinationSelection>([
  ['first', 1], ['second', 2], ['third', 3], ['last', 'last'],
  ['nhat', 1], ['mot', 1], ['hai', 2], ['ba', 3], ['cuoi', 'last'], ['cuoi cung', 'last'],
  ['1', 1], ['2', 2], ['3', 3], ['1st', 1], ['2nd', 2], ['3rd', 3],
]);

/** Closed wording so an educational request mentioning an ordinal stays a question. */
export function destinationSelection(message: string): DestinationSelection | null {
  const text = normalizeDestination(message).replace(/ (?:please|di|nhe|voi)$/, '');
  if (/^(?:open|show me) (?:this|that)(?: one)?$|^(?:mo|xem) (?:(?:cai|muc) (?:do|nay)|no)$/u.test(text)) {
    return 'only';
  }
  const en = /^(?:open|show me) (?:(?:the )?(first|second|third|last|1st|2nd|3rd)(?: (?:one|option))?|(?:option|number) ([1-3]))$/u.exec(text);
  const vi = /^(?:mo|xem) (?:(?:cai|muc|lua chon) )?(?:(?:thu|so) (nhat|mot|hai|ba|[1-3])|(cuoi(?: cung)?))$/u.exec(text);
  return ORDINALS.get(en?.[1] ?? en?.[2] ?? vi?.[1] ?? vi?.[2] ?? '') ?? null;
}

/** The newest reply's ordering controls explicit selection. A later reply without options breaks the link. */
export function lastDestinations(history: CoachMessageRow[]) {
  const last = history.at(-1);
  return last?.role === 'AI' ? last.destinations : undefined;
}

/** Give indirect follow-ups a few recent destinations alongside ordinary conversation text. */
export function referencedDestinations(message: string, history: CoachMessageRow[]) {
  if (!/\b(?:first|second|third|last one|same|similar|this one|that one|that video|that lesson|it|former|latter|thu (?:nhat|hai|ba)|cai do|muc do|tuong tu|vua roi)\b/u
    .test(normalizeDestination(message))) return undefined;
  return history.slice(-4).reverse().find((row) => row.destinations?.length)?.destinations;
}

const RECALL_CUE = /\b(?:earlier|previously|last time|we discussed|you told me|i (?:wrote|said|asked) before|remember (?:when|what)|nhac lai|luc nay|lan truoc|truoc do|da noi|da viet|da hoi|con nho)\b/u;
const RECALL_COMMON = new Set([
  'what', 'which', 'was', 'were', 'did', 'had', 'have', 'the', 'and', 'that',
  'this', 'about', 'example', 'examples', 'sentence', 'sentences', 'earlier', 'previously', 'before',
  'last', 'time', 'discussed', 'told', 'remember', 'used', 'use', 'wrote', 'said',
  'you', 'can', 'could', 'please', 'tell', 'phrase', 'our', 'repeat', 'exact', 'english',
  'minh', 'toi', 'ban', 'cho', 'nao', 'gi', 'cai', 'luc', 'nay', 'truoc',
  'lan', 'noi', 'hoi', 'dung', 'nho', 'nhac', 'viet', 'tung', 'tiep', 'cau', 'cum', 'tieng', 'anh', 'vua', 'roi',
]);

/** A request for an earlier example in this conversation stays with the tutor. */
export function isTutorExampleRecall(message: string): boolean {
  const text = normalizeDestination(message);
  if (text.length > 180 || /[;.!?？]\s*\p{L}/u.test(message)
    || /\b(?:and then|(?:and|then) (?:give|open|show|explain)|roi (?:mo|cho|giai thich))\b/u.test(text)) return false;
  const asksForExample = /^(?:what|which) (?:english )?(?:example|sentence|phrase) (?:did (?:we|i|you) (?:use|write|say|practice|practise)|was|were)\b/u.test(text)
    || /^(?:what (?:was|were)|(?:could|can) you repeat) (?:the |my |our )?(?:exact )?(?:sentence|phrase|example)\b/u.test(text);
  return (asksForExample && / (?:earlier|last time|previously|before)$/u.test(text))
    || (/^nhac lai (?:giup (?:minh|toi) )?(?:cau|vi du|cum tu)\b/u.test(text) && / (?:luc nay|lan truoc|truoc do|vua roi)$/u.test(text));
}

export function hasLearningRecallCue(message: string): boolean {
  return RECALL_CUE.test(normalizeDestination(message)) || isTutorExampleRecall(message);
}

export function learningHistoryLimit(message: string): number {
  return hasLearningRecallCue(message) ? 48 : 10;
}

/** Older turns are retrieved on explicit recall requests and capped before generation. */
export function recallLearningExamples(message: string, history: MessageRow[], recentMessages = 8) {
  if (history.length <= recentMessages || !hasLearningRecallCue(message)) return [];
  const keywords = [...new Set(normalizeDestination(message).split(' ').filter((term) => term.length > 2 && !RECALL_COMMON.has(term)))];
  if (!keywords.length) return [];
  const matches: Array<{ learner: string; reply: string; score: number; id: number }> = [];
  const earlier = history.slice(0, -recentMessages);
  for (const [index, question] of earlier.entries()) {
    const answer = earlier[index + 1];
    if (question.role !== 'USER' || answer?.role !== 'AI' || RECALL_CUE.test(normalizeDestination(question.content))) continue;
    const learnerTerms = new Set(normalizeDestination(question.content).split(' '));
    const coachTerms = new Set(normalizeDestination(answer.content).split(' '));
    const score = keywords.reduce((total, term) =>
      total + (learnerTerms.has(term) ? 3 : coachTerms.has(term) ? 1 : 0), 0);
    if (score >= 3) matches.push({
      learner: question.content.slice(0, 420), reply: answer.content.slice(0, 420), score, id: question.id,
    });
  }
  const picked = new Set<string>();
  return matches.sort((a, b) => b.score - a.score || b.id - a.id)
    .filter(({ learner }) => {
      if (picked.has(learner)) return false;
      picked.add(learner);
      return true;
    }).slice(0, 2)
    .map(({ learner, reply }) => ({ learner, reply }));
}
