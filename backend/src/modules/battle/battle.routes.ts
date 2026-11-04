import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './battle.controller';

export const battleRouter = Router();

battleRouter.get('/battle/summary', authenticate, controller.getSummary);
