import type { RequestHandler } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import * as speechService from './speech.service';
import { parseSpeechAudio, parseSpeechMimeType } from './speech.validation';

/**
 * `POST /api/speech/transcribe` — raw audio body (no multipart), format carried
 * in Content-Type. The web recorder posts a 60-second WebM/Opus clip.
 */
export const transcribe: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const mime = parseSpeechMimeType(request.headers['content-type']);
    const audio = parseSpeechAudio(request.body, env.speechMaxBytes);
    const transcript = await speechService.transcribeSpeech(audio, mime);
    if (!transcript) {
      response.status(422).json({
        success: false,
        error: 'Không nghe được nội dung trong đoạn ghi âm. Hãy nói lại gần micro hơn nhé.',
        code: 'NO_SPEECH',
      });
      return;
    }
    response.json({ success: true, data: transcript });
  } catch (error) {
    next(error);
  }
};

/**
 * `GET /api/speech/status` — lets the web decide whether to use the browser's
 * Web Speech API or post audio to the backend. Deliberately public metadata:
 * no keys, just booleans.
 */
export const status: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: {
      backend: env.cfAccounts.length > 0 || Boolean(env.aiApiKey.trim()),
      whisper: env.cfAccounts.length > 0,
      gemini: Boolean(env.aiApiKey.trim()),
      maxBytes: env.speechMaxBytes,
    },
  });
};
