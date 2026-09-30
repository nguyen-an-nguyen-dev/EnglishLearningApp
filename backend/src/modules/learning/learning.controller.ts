import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as learningService from './learning.service';
import {
  parseCheckAnswerInput,
  parseCompleteLessonInput,
  parseLessonId,
  parseQuestionId,
  parseStageId,
} from './learning.validation';

// GET /api/stages
export const getStages: RequestHandler = async (_request, response, next) => {
  try {
    const stages = await learningService.getStages();
    response.json({ success: true, data: { stages } });
  } catch (error) {
    next(error);
  }
};

// GET /api/stages/:stageId
export const getStage: RequestHandler = async (request, response, next) => {
  try {
    const stageId = parseStageId(request.params.stageId);
    const stage = await learningService.getStageById(stageId);
    response.json({ success: true, data: { stage } });
  } catch (error) {
    next(error);
  }
};

// GET /api/stages/:stageId/lessons
export const getLessonsByStage: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const stageId = parseStageId(request.params.stageId);
    const lessons = await learningService.getLessonsByStage(stageId, request.auth.userId);
    response.json({ success: true, data: { lessons } });
  } catch (error) {
    next(error);
  }
};

// GET /api/lessons/:lessonId
export const getLesson: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const lessonId = parseLessonId(request.params.lessonId);
    const lesson = await learningService.getLessonDetail(lessonId, request.auth.userId);
    response.json({ success: true, data: { lesson } });
  } catch (error) {
    next(error);
  }
};

// GET /api/lessons/:lessonId/questions
export const getLessonQuestions: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const lessonId = parseLessonId(request.params.lessonId);
    const questions = await learningService.getLessonQuestions(lessonId, request.auth.userId);
    response.json({ success: true, data: { questions } });
  } catch (error) {
    next(error);
  }
};

// POST /api/lessons/:lessonId/questions/:questionId/check
export const checkLessonAnswer: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const lessonId = parseLessonId(request.params.lessonId);
    const questionId = parseQuestionId(request.params.questionId);
    const input = parseCheckAnswerInput(request.body);
    const result = await learningService.checkLessonAnswer(lessonId, questionId, request.auth.userId, input);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/progress
export const getProgress: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const progress = await learningService.getUserProgress(request.auth.userId);
    response.json({ success: true, data: progress });
  } catch (error) {
    next(error);
  }
};

// POST /api/lessons/:lessonId/complete
export const completeLesson: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const lessonId = parseLessonId(request.params.lessonId);
    const input = parseCompleteLessonInput(request.body);
    const result = await learningService.completeLesson(lessonId, request.auth.userId, input);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
