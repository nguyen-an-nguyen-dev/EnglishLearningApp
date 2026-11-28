import { isOperationRequest, normalizeDestination } from './ai.language';
import { hasLearningRecallCue } from './ai.memory';
import type { ChatIntent } from './ai.types';

export function explicitLearningIntent(message: string): ChatIntent | null {
  const text = normalizeDestination(message).replace(
    /^(?:please |(?:hi|hello|xin chao|chao ban) |(?:could|can|would) you |(?:ban |bac )?co the )+/u, '',
  );
  if (/^(?:(?:give me|make|create|write) (?:me )?(?:a |an |one |some )?(?:short |practice |fill in the blank |multiple choice )?(?:exercise|quiz)|quiz me|(?:ra|tao|cho) (?:cho )?(?:(?:minh|toi) )?(?:mot |vai )?(?:bai tap|cau hoi luyen))\b/u.test(text)) {
    return 'practice';
  }
  if (/^(?:what should i study (?:today|next|first)|(?:make|create) (?:me )?(?:a |my )?study plan|hom nay (?:(?:minh|toi) )?(?:nen )?hoc gi|lap (?:ke hoach|lo trinh) hoc)\b/u.test(text)) {
    return 'plan';
  }
  if (/^(?:how (?:do|can) i|where do i|lam the nao de|lam sao de|cach)\b.*\b(?:engorace|in (?:this |the )?app|vocabulary notebook|so tu|nut|trong ung dung)\b/u.test(text)) {
    return 'how';
  }
  if (/^(?:explain|define|giai thich|dinh nghia)\b|^what does .+ mean$|^.+ (?:co )?nghia la gi$/u.test(text)
    || (/^(?:compare|so sanh)\b/u.test(text)
      && /\b(?:grammar|tense|sentences?|words?|past|present|perfect|forms?|thi|tu|ngu phap|cau|cach dung)\b/u.test(text))) {
    return 'explain';
  }
  return null;
}

export function isPlainTutorChat(message: string): boolean {
  const text = normalizeDestination(message);
  if (/^(?:hi|hey|hello(?: there)?|thanks|thank you|chao|xin chao|cam on)$/u.test(text)) return true;
  return text.length <= 180 && !/[?？]/u.test(message)
    && /^(?:(?:yesterday|today|this morning|last night|last week) )?(?:i|we|my|our)\b|^(?:minh|toi) (?:da|vua|thich|thuong)\b/u.test(text)
    && !/[;.!]\s*(?:please\s+)?(?:give|make|create|explain|show|open|quiz)\b/iu.test(message)
    && !/\b(?:want|need|help|should|could|would|confused|mean|explain|how|why|plan|correct|translate|practice|muon|can|nen|giup|hoi|giai thich|dich|sua)\b/u.test(text);
}

export function hasTutorContextReference(message: string): boolean {
  const text = normalizeDestination(message);
  return /\b(?:it|them|they)\b/u.test(text)
    || /\b(?:(?:this|that) (?:example|sentence|exercise|lesson|video)|this|that|these|those|the (?:same|first|second|last) one)$/u.test(text);
}

/** Short, single-sentence practice can use the primary model's brief mode. */
export function isBriefTutorTurn(message: string): boolean {
  const sentence = message.trim().replace(/[.!]+$/u, '');
  const text = normalizeDestination(sentence);
  return sentence.length <= 100 && !/[.!?;:\r\n。！？]/u.test(sentence)
    && isPlainTutorChat(message) && !hasLearningRecallCue(message)
    && !/\b(?:if|unless|whether|although|though|because|whereas|however|but|suppose|provided|please|give|open|explain|show|compare|quiz)\b/u.test(text)
    && !hasTutorContextReference(message);
}

/** A grammar explanation may recommend a destination without opening it. */
export function isGrammarExplanation(message: string): boolean {
  const text = normalizeDestination(message);
  const topic = text.search(/\b(?:grammar|tense|(?:past|present) (?:simple|continuous|perfect)|simple (?:past|present)|verbs?|word order|ngu phap|dong tu|thi qua khu|qua khu don|hien tai hoan thanh|trat tu tu)\b/u);
  if (topic < 0) return false;
  const asksForExplanation = explicitLearningIntent(message) === 'explain'
    || /^(?:how (?:do|can|should) (?:i|we) (?:use|form)|when (?:do|can|should) (?:i|we) use|cach dung|(?:minh |toi )?dung .+ nhu the nao|thi .+ dung khi nao)\b/u.test(text)
    || /^what (?:is|are) (?:the |a |an )?(?:difference between |rules? for )?$/u.test(text.slice(0, topic));
  if (!asksForExplanation) return false;
  return !message.split(/[,;.!?]|(?<=\s)(?:and then|and|then|also|và sau đó|và|rồi|sau đó|đồng thời)(?=\s)/iu)
    .some(isOperationRequest);
}
