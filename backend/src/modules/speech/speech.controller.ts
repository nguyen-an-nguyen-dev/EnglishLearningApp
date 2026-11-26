import type { RequestHandler } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/error-handler';
import * as speechService from './speech.service';
import { findSpeechModel, SPEECH_MODELS } from './speech.models';
import { synthesizeSpeech } from './speech.tts';
import { parsePracticeText, parseSpeechAudio, parseSpeechLanguage, parseSpeechMimeType, parseTtsRequest } from './speech.validation';

/**
 * `POST /api/speech/transcribe` — raw audio body (no multipart), format from
 * Content-Type.
 */
function recognitionHandler(practice: boolean): RequestHandler {
  return async (request, response, next) => {
    try {
      if (!request.auth) throw new HttpError(401, 'Authentication required.');
      const mime = parseSpeechMimeType(request.headers['content-type']);
      const audio = parseSpeechAudio(request.body, env.speechMaxBytes);
      const language = parseSpeechLanguage(request.query.lang, practice ? 'en' : null);
      const requestedModel = typeof request.query.model === 'string' ? request.query.model.trim() : '';
      if (requestedModel && !findSpeechModel(requestedModel)) {
        throw new HttpError(422, 'Mô hình nhận diện không hợp lệ.');
      }
      const transcript = practice
        ? await speechService.practiceSpeech(audio, mime, parsePracticeText(request.query.text))
        : await speechService.transcribeSpeech(audio, mime, language, requestedModel || null);
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
}

export const transcribe = recognitionHandler(false);
export const practice = recognitionHandler(true);

/** `POST /api/speech/synthesize` — JSON `{ text, lang }` in, MP3 bytes out. */
export const synthesize: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const { text, lang } = parseTtsRequest(request.body);
    const audio = await synthesizeSpeech(text, lang);
    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.send(audio);
  } catch (error) {
    next(error);
  }
};

/**
 * `GET /api/speech/status` — the web records a clip whenever AssemblyAI is
 * configured. Public metadata only: booleans, no keys.
 */
export const status: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: {
      backend: Boolean(env.assemblyAiApiKey),
      ...(env.assemblyAiApiKey && process.env.BUDDY_STREAMING_STT === 'true' ? { buddyStreaming: true } : {}),
      speechModel: env.speechModel,
      maxBytes: env.speechMaxBytes,
    },
  });
};

export const models: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: {
      models: SPEECH_MODELS,
      defaultModel: env.speechModel,
    },
  });
};
