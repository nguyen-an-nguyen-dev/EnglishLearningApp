import { HttpError } from '../../middleware/error-handler';
import type { CompleteLessonInput, SubmittedAnswer } from './learning.types';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

export function parseCompleteLessonInput(value: unknown): CompleteLessonInput {
  const body = asObject(value);
  const errors: string[] = [];

  if (!Array.isArray(body.answers)) {
    errors.push('answers must be an array.');
  } else if (body.answers.length === 0) {
    errors.push('answers must contain at least one answer.');
  } else {
    for (let i = 0; i < body.answers.length; i++) {
      const item = body.answers[i] as Record<string, unknown>;
      if (typeof item !== 'object' || item === null) {
        errors.push(`answers[${i}] must be an object.`);
        continue;
      }
      if (typeof item.questionId !== 'number' || !Number.isInteger(item.questionId) || item.questionId < 1) {
        errors.push(`answers[${i}].questionId must be a positive integer.`);
      }
      if (typeof item.answer !== 'string') {
        errors.push(`answers[${i}].answer must be a string.`);
      }
    }
  }

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);

  return {
    answers: (body.answers as unknown[]).map((item) => {
      const a = item as Record<string, unknown>;
      return {
        questionId: a.questionId as number,
        answer: (a.answer as string).trim(),
      } as SubmittedAnswer;
    }),
  };
}

export function parseStageId(value: unknown): number {
  const str = Array.isArray(value) ? value[0] : typeof value === 'string' ? value : String(value ?? '');
  const id = Number(str);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid stage ID.');
  return id;
}

export function parseLessonId(value: unknown): number {
  const str = Array.isArray(value) ? value[0] : typeof value === 'string' ? value : String(value ?? '');
  const id = Number(str);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid lesson ID.');
  return id;
}
