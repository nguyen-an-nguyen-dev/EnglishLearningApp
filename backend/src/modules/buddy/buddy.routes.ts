import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './buddy.controller';

export const buddyRouter = Router();

buddyRouter.use(authenticate);
buddyRouter.get('/nudges', controller.getNudges);
buddyRouter.post('/ask', controller.ask);
buddyRouter.post('/reminder-suggestion', controller.acceptSuggestion);
