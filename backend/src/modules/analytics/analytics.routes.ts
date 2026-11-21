import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './analytics.controller';

export const analyticsRouter = Router();

// Auth is attached per route, not with a blanket `use`: this router is mounted
// at `/api`, so a router-level guard would answer 401 for any unknown `/api/*`
// path instead of letting it fall through to the 404 handler.
analyticsRouter.get('/analytics', authenticate, controller.getAnalytics);

analyticsRouter.get('/review', authenticate, controller.getReviewQueue);
analyticsRouter.post('/review/sync', authenticate, controller.syncReviewQueue);
analyticsRouter.post('/review/items', authenticate, controller.addReviewItem);
analyticsRouter.post('/review/items/:itemId/answer', authenticate, controller.answerReviewItem);
