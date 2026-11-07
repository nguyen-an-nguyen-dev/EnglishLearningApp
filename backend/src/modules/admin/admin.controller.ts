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
  parseStageId,
  parseStageInput,
  parseStagePatch,
  parseVideoId,
} from './admin.validation';

function requireUserId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

// ─── Content tree ────────────────────────────────────────────────────────────

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

// ─── Stages ──────────────────────────────────────────────────────────────────

export const createStage: RequestHandler = async (request, response, next) => {
  try {
    const input = parseStageInput(request.body);
    const stage = await adminService.createStage(input);
    response.status(201).json({ success: true, data: { stage } });
  } catch (error) {
    next(error);
  }
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

// ─── Lessons ─────────────────────────────────────────────────────────────────

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

// ─── Questions ───────────────────────────────────────────────────────────────

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

// ─── Shared video library ────────────────────────────────────────────────────

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
    const adminUserId = requireUserId(request);
    const input = parseSharedVideoImport(request.body);
    const video = await adminService.importSharedVideo(adminUserId, input);
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
