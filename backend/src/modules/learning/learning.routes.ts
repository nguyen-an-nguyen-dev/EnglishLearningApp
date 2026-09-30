import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './learning.controller';

export const learningRouter = Router();

// Stages
learningRouter.get('/stages', controller.getStages);
learningRouter.get('/stages/:stageId', controller.getStage);
learningRouter.get('/stages/:stageId/lessons', authenticate, controller.getLessonsByStage);

// Lessons
learningRouter.get('/lessons/:lessonId', authenticate, controller.getLesson);
learningRouter.get('/lessons/:lessonId/questions', authenticate, controller.getLessonQuestions);
learningRouter.post('/lessons/:lessonId/questions/:questionId/check', authenticate, controller.checkLessonAnswer);
learningRouter.post('/lessons/:lessonId/complete', authenticate, controller.completeLesson);

// Progress
learningRouter.get('/progress', authenticate, controller.getProgress);
