import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
}
process.env.AI_API_KEY = 'test-only-provider-key';

let server: Server;
let baseUrl: string;
let email: string;
let token: string;
let pool: typeof import('../src/db/pool').pool;
let originalFetch: typeof fetch;
let providerResponse: Response | Error | null = null;
let persistentProviderResponse: Response | null = null;
let providerCallCount = 0;
let providerRequest: { model?: string; max_tokens?: number; response_format?: unknown; messages?: Array<{ content: string }> } | null = null;

function geminiResponse(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

before(async () => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions') {
      providerCallCount++;
      providerRequest = typeof init?.body === 'string'
        ? JSON.parse(init.body) as typeof providerRequest
        : null;
      if (persistentProviderResponse) return persistentProviderResponse;
      const response = providerResponse;
      providerResponse = null;
      if (response instanceof Error) throw response;
      return response ?? geminiResponse({ translation: 'Xin chào', wordDetails: null });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const [{ app }, db] = await Promise.all([import('../src/app'), import('../src/db/pool')]);
  pool = db.pool;
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Translation test server failed to bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;

  email = `translation-${randomUUID()}@example.test`;
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Translation Test', email, password: 'correct-horse-7' }),
  });
  assert.equal(register.status, 201);
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-7' }),
  });
  assert.equal(login.status, 200);
  token = (await login.json() as { data: { token: string } }).data.token;
});

after(async () => {
  if (globalThis.fetch !== originalFetch) globalThis.fetch = originalFetch;
  if (email) {
    await pool.execute('DELETE FROM translations WHERE user_id = (SELECT id FROM users WHERE email = ?)', [email]);
    await pool.execute('DELETE FROM users WHERE email = ?', [email]);
  }
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await pool.end();
});

test('translation API supports both directions, words, TXT uploads, validation, failures, and history', async () => {
  const auth = { Authorization: `Bearer ${token}` };
  const translate = (text: string, sourceLanguage: string, targetLanguage: string) => fetch(`${baseUrl}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  });

  providerResponse = geminiResponse('Xin chào buổi sáng.');
  const englishToVietnamese = await translate('Good morning', 'en', 'vi');
  assert.equal(englishToVietnamese.status, 201);
  const firstResult = await englishToVietnamese.json() as { data: { translatedText: string; fileName: string | null } };
  assert.equal(firstResult.data.translatedText, 'Xin chào buổi sáng.');
  assert.equal(firstResult.data.fileName, null);
  assert.equal(providerRequest?.response_format, undefined, 'plain text translation skips structured output mode');
  assert.ok((providerRequest?.max_tokens ?? 8192) <= 512);
  assert.match(providerRequest?.messages?.[0]?.content ?? '', /Return only the translated text/);

  providerResponse = geminiResponse({
    translation: 'xin chào',
    wordDetails: {
      phonetic: '/həˈloʊ/',
      partOfSpeech: 'interjection',
      meaning: 'lời chào',
      example: 'Hello, how are you?',
    },
  });
  const wordTranslation = await translate('hello', 'en', 'vi');
  assert.equal(wordTranslation.status, 201);
  const wordResult = await wordTranslation.json() as { data: { wordDetails: { phonetic: string; partOfSpeech: string } } };
  assert.equal(wordResult.data.wordDetails.phonetic, '/həˈloʊ/');
  assert.equal(wordResult.data.wordDetails.partOfSpeech, 'interjection');
  assert.deepEqual(providerRequest?.response_format, { type: 'json_object' });

  providerResponse = geminiResponse({
    translation: 'con mèo',
    wordDetails: {
      phonetic: null,
      partOfSpeech: 'Noun (n.)',
      meaning: 'con mèo',
    },
  });
  const partialWord = await translate('cat', 'en', 'vi');
  assert.equal(partialWord.status, 201);
  const partialWordResult = await partialWord.json() as {
    data: { translatedText: string; wordDetails: { phonetic: string; partOfSpeech: string; example: string } };
  };
  assert.equal(partialWordResult.data.translatedText, 'con mèo');
  assert.equal(partialWordResult.data.wordDetails.phonetic, '');
  assert.equal(partialWordResult.data.wordDetails.partOfSpeech, 'noun');
  assert.equal(partialWordResult.data.wordDetails.example, '');

  providerResponse = geminiResponse('```json\n{"translation":"quyển sách","wordDetails":{"partOfSpeech":"noun"}}\n```');
  const fencedWord = await translate('book', 'en', 'vi');
  assert.equal(fencedWord.status, 201);
  const fencedWordResult = await fencedWord.json() as { data: { translatedText: string } };
  assert.equal(fencedWordResult.data.translatedText, 'quyển sách');

  providerResponse = geminiResponse({
    translation: 'con chó',
    wordDetails: [
      { phonetic: '/tʃɔ/', partOfSpeech: 'noun', meaning: 'con chó', example: 'The dog barks loudly.' },
    ],
  });
  const arrayWord = await translate('dog', 'en', 'vi');
  assert.equal(arrayWord.status, 201);
  const arrayWordResult = await arrayWord.json() as {
    data: { wordDetails: { phonetic: string; partOfSpeech: string; example: string } };
  };
  assert.equal(arrayWordResult.data.wordDetails.phonetic, '/tʃɔ/');
  assert.equal(arrayWordResult.data.wordDetails.partOfSpeech, 'noun');

  providerResponse = geminiResponse('sách');
  const plainWord = await translate('book', 'en', 'vi');
  assert.equal(plainWord.status, 201);
  const plainWordResult = await plainWord.json() as {
    data: { translatedText: string; wordDetails: null };
  };
  assert.equal(plainWordResult.data.translatedText, 'sách');
  assert.equal(plainWordResult.data.wordDetails, null);

  providerResponse = geminiResponse('I love learning English.');
  const vietnameseToEnglish = await translate('Tôi thích học tiếng Anh.', 'vi', 'en');
  assert.equal(vietnameseToEnglish.status, 201);
  const secondResult = await vietnameseToEnglish.json() as { data: { translatedText: string } };
  assert.equal(secondResult.data.translatedText, 'I love learning English.');

  assert.equal((await translate('  ', 'en', 'vi')).status, 422);
  assert.equal((await translate('x'.repeat(10_001), 'en', 'vi')).status, 413);
  assert.equal((await translate('hello', 'en', 'en')).status, 422);

  const upload = new FormData();
  upload.append('sourceLanguage', 'en');
  upload.append('targetLanguage', 'vi');
  upload.append('file', new Blob(['A small text file.'], { type: 'text/plain' }), 'sample.txt');
  providerResponse = geminiResponse('Một tệp văn bản nhỏ.');
  const uploadResponse = await fetch(`${baseUrl}/api/translate/file`, {
    method: 'POST',
    headers: auth,
    body: upload,
  });
  assert.equal(uploadResponse.status, 201);
  const fileResult = await uploadResponse.json() as { data: { fileName: string; originalText: string; translatedText: string } };
  assert.equal(fileResult.data.fileName, 'sample.txt');
  assert.equal(fileResult.data.originalText, 'A small text file.');
  assert.equal(fileResult.data.translatedText, 'Một tệp văn bản nhỏ.');

  const invalidFile = new FormData();
  invalidFile.append('sourceLanguage', 'en');
  invalidFile.append('targetLanguage', 'vi');
  invalidFile.append('file', new Blob(['not a text extension'], { type: 'text/plain' }), 'sample.pdf');
  const invalidUpload = await fetch(`${baseUrl}/api/translate/file`, {
    method: 'POST',
    headers: auth,
    body: invalidFile,
  });
  assert.equal(invalidUpload.status, 422);

  const oversizedFile = new FormData();
  oversizedFile.append('sourceLanguage', 'en');
  oversizedFile.append('targetLanguage', 'vi');
  oversizedFile.append('file', new Blob(['x'.repeat(100 * 1024 + 1)], { type: 'text/plain' }), 'large.txt');
  const oversizedUpload = await fetch(`${baseUrl}/api/translate/file`, {
    method: 'POST',
    headers: auth,
    body: oversizedFile,
  });
  assert.equal(oversizedUpload.status, 413);

  persistentProviderResponse = new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
  const callsBefore = providerCallCount;
  const failedTranslation = await translate('This must not be stored', 'en', 'vi');
  assert.equal(failedTranslation.status, 503);
  assert.equal(providerCallCount - callsBefore, 2, 'a busy primary model retries once on the fallback model');
  assert.equal(providerRequest?.model, 'gemini-3.5-flash', 'fallback model is used for the retry');
  persistentProviderResponse = null;

  const historyResponse = await fetch(`${baseUrl}/api/translations`, { headers: auth });
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json() as { data: { translations: Array<{ fileName: string | null; originalText: string }> } };
  assert.equal(history.data.translations.length, 8);
  assert.equal(history.data.translations[0].fileName, 'sample.txt');
  assert.equal(history.data.translations[0].originalText, 'A small text file.');
  assert.equal(history.data.translations.some((item) => item.originalText === 'This must not be stored'), false);

  const [storedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT file_name, original_text, translated_text, user_id
     FROM translations WHERE file_name = 'sample.txt' ORDER BY id DESC LIMIT 1`,
  );
  assert.ok(storedRows[0]);
  assert.equal(storedRows[0].original_text, 'A small text file.');
});
