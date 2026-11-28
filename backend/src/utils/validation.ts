export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function optionalText(
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

export function requiredText(
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

export function boundedInt(
  raw: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}.`);
    return undefined;
  }
  return value;
}

export function positiveId(value: unknown, field: string): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new Error(`Invalid ${field}.`);
  return id;
}
