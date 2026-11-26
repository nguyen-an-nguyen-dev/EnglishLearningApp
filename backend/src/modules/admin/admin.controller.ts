import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as adminService from './admin.service';
import {
  parseLessonId,
  parseLessonInput,
  parseLessonPatch,
  parseMoveDirection,
  parseQuestionId,
  parseQuestionInput,
  parseQuestionPatch,
  parseSharedVideoImport,
  parseSharedVideoPatch,
  parseSharedVideoSegments,
  parseStageId,
  parseStagePatch,
  parseVideoId,
} from './admin.validation';

export const getContent: RequestHandler = async (_request, response, next) => {
  try {
    const stages = await adminService.getContent();
    response.json({ success: true, data: { stages } });
  } catch (error) {
    next(error);
  }
};

export const getLessonQuestions: RequestHandler = async (request, response, next) => {
  try {
    const lessonId = parseLessonId(request.params.lessonId);
    const questions = await adminService.getLessonQuestions(lessonId);
    response.json({ success: true, data: { questions } });
  } catch (error) {
    next(error);
  }
};

export const createStage: RequestHandler = (_request, _response, next) => {
  next(new HttpError(409, 'Lộ trình có sáu chặng cố định. Hãy thêm bài học vào một chặng có sẵn.', ['FIXED_ROADMAP_STAGES']));
};

export const updateStage: RequestHandler = async (request, response, next) => {
  try {
    const stageId = parseStageId(request.params.stageId);
    const patch = parseStagePatch(request.body);
    const stage = await adminService.updateStage(stageId, patch);
    response.json({ success: true, data: { stage } });
  } catch (error) {
    next(error);
  }
};

export const deleteStage: RequestHandler = async (request, response, next) => {
  try {
    const stageId = parseStageId(request.params.stageId);
    await adminService.deleteStage(stageId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const moveStage: RequestHandler = async (request, response, next) => {
  try {
    const stageId = parseStageId(request.params.stageId);
    const direction = parseMoveDirection(request.body);
    await adminService.moveStage(stageId, direction);
    response.json({ success: true, data: { moved: true } });
  } catch (error) {
    next(error);
  }
};

export const createLesson: RequestHandler = async (request, response, next) => {
  try {
    const input = parseLessonInput(request.body);
    const lesson = await adminService.createLesson(input);
    response.status(201).json({ success: true, data: { lesson } });
  } catch (error) {
    next(error);
  }
};

export const updateLesson: RequestHandler = async (request, response, next) => {
  try {
    const lessonId = parseLessonId(request.params.lessonId);
    const patch = parseLessonPatch(request.body);
    const lesson = await adminService.updateLesson(lessonId, patch);
    response.json({ success: true, data: { lesson } });
  } catch (error) {
    next(error);
  }
};

export const deleteLesson: RequestHandler = async (request, response, next) => {
  try {
    const lessonId = parseLessonId(request.params.lessonId);
    await adminService.deleteLesson(lessonId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const moveLesson: RequestHandler = async (request, response, next) => {
  try {
    const lessonId = parseLessonId(request.params.lessonId);
    const direction = parseMoveDirection(request.body);
    await adminService.moveLesson(lessonId, direction);
    response.json({ success: true, data: { moved: true } });
  } catch (error) {
    next(error);
  }
};

export const createQuestion: RequestHandler = async (request, response, next) => {
  try {
    const lessonId = parseLessonId(request.params.lessonId);
    const input = parseQuestionInput(request.body);
    const question = await adminService.createQuestion(lessonId, input);
    response.status(201).json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion: RequestHandler = async (request, response, next) => {
  try {
    const questionId = parseQuestionId(request.params.questionId);
    const patch = parseQuestionPatch(request.body);
    const question = await adminService.updateQuestion(questionId, patch);
    response.json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion: RequestHandler = async (request, response, next) => {
  try {
    const questionId = parseQuestionId(request.params.questionId);
    await adminService.deleteQuestion(questionId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const moveQuestion: RequestHandler = async (request, response, next) => {
  try {
    const questionId = parseQuestionId(request.params.questionId);
    const direction = parseMoveDirection(request.body);
    await adminService.moveQuestion(questionId, direction);
    response.json({ success: true, data: { moved: true } });
  } catch (error) {
    next(error);
  }
};

export const listSharedVideos: RequestHandler = async (_request, response, next) => {
  try {
    const videos = await adminService.listSharedVideos();
    response.json({ success: true, data: { videos } });
  } catch (error) {
    next(error);
  }
};

export const importSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const input = parseSharedVideoImport(request.body);
    const video = await adminService.importSharedVideo(input);
    response.status(201).json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const updateSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const patch = parseSharedVideoPatch(request.body);
    const video = await adminService.updateSharedVideo(videoId, patch);
    response.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const deleteSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    await adminService.deleteSharedVideo(videoId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const listSharedVideoSegments: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const result = await adminService.listSharedVideoSegments(videoId);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const replaceSharedVideoSegments: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const segments = parseSharedVideoSegments(request.body);
    const result = await adminService.replaceSharedVideoSegments(videoId, segments);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const publishSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const video = await adminService.setSharedVideoPublished(videoId, true);
    response.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const unpublishSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const video = await adminService.setSharedVideoPublished(videoId, false);
    response.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const moveSharedVideo: RequestHandler = async (request, response, next) => {
  try {
    const videoId = parseVideoId(request.params.videoId);
    const direction = parseMoveDirection(request.body);
    await adminService.moveSharedVideo(videoId, direction);
    response.json({ success: true, data: { moved: true } });
  } catch (error) {
    next(error);
  }
};

export const getStatsOverview: RequestHandler = async (_request, response, next) => {
  try {
    const overview = await adminService.getStatsOverview();
    response.json({ success: true, data: { overview } });
  } catch (error) {
    next(error);
  }
};

export const getStatsTrend: RequestHandler = async (request, response, next) => {
  try {
    const raw = Number(request.query.days);
    const days = Number.isFinite(raw) && raw > 0 ? raw : 14;
    const trend = await adminService.getActivityTrend(days);
    response.json({ success: true, data: { trend } });
  } catch (error) {
    next(error);
  }
};

export const getStatsLessons: RequestHandler = async (_request, response, next) => {
  try {
    const [stages, lessons] = await Promise.all([
      adminService.getStageStats(),
      adminService.getLessonStats(),
    ]);
    response.json({ success: true, data: { stages, lessons } });
  } catch (error) {
    next(error);
  }
};

export const getStatsContent: RequestHandler = async (_request, response, next) => {
  try {
    const content = await adminService.getContentStats();
    response.json({ success: true, data: { content } });
  } catch (error) {
    next(error);
  }
};

export const listInactiveUsers: RequestHandler = async (request, response, next) => {
  try {
    const rawDays = Number(request.query.days);
    const rawLimit = Number(request.query.limit);
    const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
    const users = await adminService.listInactiveUsers(days, limit);
    response.json({ success: true, data: { users, days, limit } });
  } catch (error) {
    next(error);
  }
};
