import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import * as controller from './admin.controller';

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
