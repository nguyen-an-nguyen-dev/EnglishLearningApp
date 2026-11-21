export const MAX_TEXT_FILE_BYTES = 20 * 1024;

/** Reads a plain-text upload with a size cap, shared so every import surface enforces it. */
export async function readTextFile(
  file: File,
  maxBytes = MAX_TEXT_FILE_BYTES,
): Promise<string> {
  if (file.size > maxBytes) throw new Error('FILE_TOO_LARGE');
  return file.text();
}
