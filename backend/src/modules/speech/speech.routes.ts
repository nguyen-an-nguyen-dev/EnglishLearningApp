import express, { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { env } from '../../config/env';
import { rateLimit, clientIp } from '../../middleware/rate-limit';
import * as controller from './speech.controller';

export const speechRouter = Router();

/** Raw audio body; `express.json` must not swallow it before this route. */
const rawAudio = express.raw({ type: 'audio/*', limit: env.speechMaxBytes });

const transcribeLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  key: (request) => `speech:${request.auth?.userId ?? clientIp(request)}`,
  message: 'Bạn đang gửi quá nhiều đoạn ghi âm. Chờ một phút rồi thử lại nhé.',
});

const synthesizeLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  key: (request) => `tts:${request.auth?.userId ?? clientIp(request)}`,
  message: 'Bạn đang nghe quá nhiều đoạn đọc. Chờ một phút rồi thử lại nhé.',
});

speechRouter.get('/status', controller.status);
speechRouter.post('/transcribe', authenticate, transcribeLimit, rawAudio, controller.transcribe);
speechRouter.post('/synthesize', authenticate, synthesizeLimit, controller.synthesize);
