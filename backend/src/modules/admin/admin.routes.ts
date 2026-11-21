import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import * as controller from './admin.controller';
import * as catalog from './admin.catalog.controller';
import * as users from './admin.users.controller';

/** Content console. Every route here needs a signed-in admin. */
export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

// Content tree
adminRouter.get('/content', controller.getContent);
adminRouter.get('/lessons/:lessonId/questions', controller.getLessonQuestions);

// Stages
adminRouter.post('/stages', controller.createStage);
adminRouter.patch('/stages/:stageId', controller.updateStage);
adminRouter.delete('/stages/:stageId', controller.deleteStage);
adminRouter.post('/stages/:stageId/move', controller.moveStage);

// Lessons
adminRouter.post('/lessons', controller.createLesson);
adminRouter.patch('/lessons/:lessonId', controller.updateLesson);
adminRouter.delete('/lessons/:lessonId', controller.deleteLesson);
adminRouter.post('/lessons/:lessonId/move', controller.moveLesson);

// Questions
adminRouter.post('/lessons/:lessonId/questions', controller.createQuestion);
adminRouter.patch('/questions/:questionId', controller.updateQuestion);
adminRouter.delete('/questions/:questionId', controller.deleteQuestion);
adminRouter.post('/questions/:questionId/move', controller.moveQuestion);

// Shared video library
adminRouter.get('/videos', controller.listSharedVideos);
adminRouter.post('/videos', controller.importSharedVideo);
adminRouter.patch('/videos/:videoId', controller.updateSharedVideo);
adminRouter.delete('/videos/:videoId', controller.deleteSharedVideo);
adminRouter.post('/videos/:videoId/move', controller.moveSharedVideo);

// Shop catalogue (cars, frames, nameplates, consumables)
adminRouter.get('/shop-items', catalog.listShopItems);
adminRouter.post('/shop-items', catalog.createShopItem);
adminRouter.patch('/shop-items/:itemId', catalog.updateShopItem);
adminRouter.delete('/shop-items/:itemId', catalog.deleteShopItem);

// Arena vocabulary
adminRouter.get('/battle-words', catalog.listBattleWords);
adminRouter.post('/battle-words', catalog.createBattleWord);
adminRouter.patch('/battle-words/:wordId', catalog.updateBattleWord);
adminRouter.delete('/battle-words/:wordId', catalog.deleteBattleWord);

// Video-learning vocabulary
adminRouter.get('/videos/:videoId/vocabulary', catalog.listVideoVocabulary);
adminRouter.post('/videos/:videoId/vocabulary', catalog.createVideoVocabulary);
adminRouter.patch('/video-vocabulary/:vocabularyId', catalog.updateVideoVocabulary);
adminRouter.delete('/video-vocabulary/:vocabularyId', catalog.deleteVideoVocabulary);

// Learner account management (progression only; passwords/emails stay private)
adminRouter.get('/users', users.listUsers);
adminRouter.patch('/users/:userId', users.updateUser);

// Statistics (admin console)
adminRouter.get('/stats/overview', controller.getStatsOverview);
adminRouter.get('/stats/trend', controller.getStatsTrend);
adminRouter.get('/stats/lessons', controller.getStatsLessons);
adminRouter.get('/stats/content', controller.getStatsContent);
adminRouter.get('/stats/inactive-users', controller.listInactiveUsers);
