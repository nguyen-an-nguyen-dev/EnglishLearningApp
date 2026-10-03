import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './badges.controller';

export const badgesRouter = Router();

badgesRouter.get('/me', authenticate, controller.getMyBadges);