export interface DatabaseErrorLike {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

function asDatabaseError(error: unknown): DatabaseErrorLike | null {
  return typeof error === 'object' && error !== null ? error as DatabaseErrorLike : null;
}

export function databaseErrorCode(error: unknown): string | null {
  return asDatabaseError(error)?.code ?? null;
}

/** Unique-key violation, used to turn races into 409 responses. */
export function isDuplicateKeyError(error: unknown): boolean {
  return databaseErrorCode(error) === 'ER_DUP_ENTRY';
}
