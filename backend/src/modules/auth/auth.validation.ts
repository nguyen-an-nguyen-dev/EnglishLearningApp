import { HttpError } from '../../middleware/error-handler';
import type { LoginInput, RegisterInput } from './auth.types';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

function validateEmail(email: string, errors: string[]): void {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email address is required.');
  }
}

export function parseRegisterInput(value: unknown): RegisterInput {
  const body = asObject(value);
  const errors: string[] = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) errors.push('Name is required.');
  if (name.length > 100) errors.push('Name must be 100 characters or fewer.');
  if (!email) errors.push('Email is required.');
  else validateEmail(email, errors);
  if (!password) errors.push('Password is required.');
  else if (password.length < 6) errors.push('Password must be at least 6 characters.');
  else if (Buffer.byteLength(password, 'utf8') > 72) errors.push('Password must be at most 72 UTF-8 bytes.');

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { name, email, password };
}

export function parseLoginInput(value: unknown): LoginInput {
  const body = asObject(value);
  const errors: string[] = [];
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) errors.push('Email is required.');
  else validateEmail(email, errors);
  if (!password) errors.push('Password is required.');

  if (errors.length) throw new HttpError(422, 'Validation failed', errors);
  return { email, password };
}