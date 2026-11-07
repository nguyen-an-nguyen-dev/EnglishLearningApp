import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as videoService from './video.service';
import {
  parseImportModel,
  parseImportUrl,
  parseSaveWordInput,
  parseSavedWord,
  parseVideoId,
  parseWatchedSeconds,
} from './video.validation';

function requireUserId(request: Parameters<RequestHandler>[0]): number {
  if (!request.auth) throw new HttpError(401, 'Authentication required.');
  return request.auth.userId;
}

export const getVideos: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const videos = await videoService.getVideos(userId);
    response.json({ success: true, data: { videos } });
  } catch (error) {
    next(error);
  }
};

export const getVideo: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const videoId = parseVideoId(request.params.videoId);
    const video = await videoService.getVideoDetail(videoId, userId);
    response.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const importVideo: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const url = parseImportUrl(request.body);
    const model = parseImportModel(request.body);
    const video = await videoService.importVideo(userId, url, model);
    response.status(201).json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const deleteVideo: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const videoId = parseVideoId(request.params.videoId);
    await videoService.deleteVideo(videoId, userId);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const saveProgress: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const videoId = parseVideoId(request.params.videoId);
    const watchedSeconds = parseWatchedSeconds(request.body);
    const result = await videoService.saveWatchProgress(videoId, userId, watchedSeconds);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const completeVideo: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const videoId = parseVideoId(request.params.videoId);
    const watchedSeconds = parseWatchedSeconds(request.body);
    const result = await videoService.completeVideo(videoId, userId, watchedSeconds);
    response.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getSavedWords: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const words = await videoService.getSavedWords(userId);
    response.json({ success: true, data: { words } });
  } catch (error) {
    next(error);
  }
};

/**
 * No `authenticate` on this one: the landing page shows it to visitors who have
 * no account yet. `video: null` means "nothing to preview", not an error.
 */
export const getDemoVideo: RequestHandler = async (_request, response, next) => {
  try {
    const video = await videoService.getDemoVideo();
    response.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const saveWord: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const input = parseSaveWordInput(request.body);
    const word = await videoService.saveWord(userId, input);
    response.status(201).json({ success: true, data: { word } });
  } catch (error) {
    next(error);
  }
};

export const deleteSavedWord: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const word = parseSavedWord(request.params.word);
    await videoService.deleteSavedWord(userId, word);
    response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};
