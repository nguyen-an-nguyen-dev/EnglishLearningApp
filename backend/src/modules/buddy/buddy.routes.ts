import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { clientIp, rateLimit } from '../../middleware/rate-limit';
import * as controller from './buddy.controller';

export const buddyRouter = Router();

buddyRouter.use(authenticate);
buddyRouter.get('/nudges', controller.getNudges);
buddyRouter.post('/ask', controller.ask);
buddyRouter.post('/voice/session', rateLimit({
  windowMs: 60_000,
  max: 20,
  key: (request) => `buddy-voice:${request.auth?.userId ?? clientIp(request)}`,
}), controller.startVoiceSession);
buddyRouter.post('/reminder-suggestion', controller.acceptSuggestion);
