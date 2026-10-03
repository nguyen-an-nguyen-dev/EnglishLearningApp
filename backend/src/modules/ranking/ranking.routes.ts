import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './ranking.controller';

export const rankingRouter = Router();

rankingRouter.get('/', authenticate, controller.getRanking);