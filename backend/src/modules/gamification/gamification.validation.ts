import { HttpError } from '../../middleware/error-handler';

/** Route params arrive as strings; the shop only ever addresses numeric item ids. */
export function parseItemId(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(422, 'Invalid item id.', ['INVALID_ITEM']);
  }
  return value;
}
