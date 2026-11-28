import { normalizeDestination, type BuddyLanguage } from './ai.language';
import type { AiReply } from './ai.types';

type Exercise = readonly [sentence: string, answer: string];

const PRACTICE: ReadonlyArray<{ topics: readonly string[]; exercises: readonly Exercise[] }> = [
  {
    topics: ['past simple', 'simple past', 'qua khu don', 'thi qua khu don'],
    exercises: [
      ['Yesterday, I ___ (go) to the library.', 'went'],
      ['Last Saturday, Mai ___ (visit) her grandparents.', 'visited'],
      ['We ___ (buy) our train tickets last night.', 'bought'],
    ],
  },
  {
    topics: ['present simple', 'simple present', 'hien tai don', 'thi hien tai don'],
    exercises: [
      ['Nam usually ___ (walk) to school.', 'walks'],
      ['My sister ___ (study) English every evening.', 'studies'],
      ['The library ___ (close) at six every weekday.', 'closes'],
    ],
  },
  {
    topics: ['past continuous', 'qua khu tiep dien', 'thi qua khu tiep dien'],
    exercises: [
      ['At eight last night, I ___ (read) a book.', 'was reading'],
      ['While we ___ (wait) for the bus, it started to rain.', 'were waiting'],
    ],
  },
  {
    topics: ['present perfect', 'hien tai hoan thanh', 'thi hien tai hoan thanh'],
    exercises: [
      ['I ___ (live) here since 2024, and I still live here.', 'have lived'],
      ['She ___ (finish) her homework, so she is ready to go.', 'has finished'],
    ],
  },
];

/** A narrow route for one standard exercise. Custom or compound prompts go to the coach. */
export function answerGrammarExercise(message: string, language: BuddyLanguage): AiReply | null {
  const text = normalizeDestination(message);
  const english = /^(?:please )?(?:give me|make|create|write) (?:a|one) fill in the blank exercise (?:about|on|for) (?:the )?(.+?)(?: (?:please )?(?:put|include|show|give) (?:me )?the answer at the end)?$/u.exec(text);
  const vietnamese = /^(?:ra|tao|cho) (?:cho )?(?:(?:minh|toi) )?mot bai(?: tap)? dien (?:tu|vao cho trong) (?:ve|chu de) (.+?)(?: (?:viet|ghi|de|dat) dap an (?:o )?cuoi(?: bai)?)?$/u.exec(text);
  const topic = (english ?? vietnamese)?.[1];
  const match = topic ? PRACTICE.find(({ topics }) => topics.includes(topic)) : undefined;
  if (!match) return null;
  const [sentence, answer] = match.exercises[Math.floor(Math.random() * match.exercises.length)];
  const instruction = language === 'en'
    ? 'Fill in the blank with the correct form of the verb.'
    : 'Điền dạng đúng của động từ vào chỗ trống.';
  return {
    reply: `${instruction}\n${sentence}\n\n${language === 'en' ? 'Answer' : 'Đáp án'}: ${answer}`,
    feedback: [], followups: [], action: null, reminder: null,
  };
}
