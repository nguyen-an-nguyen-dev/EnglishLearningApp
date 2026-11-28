import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as aiService from './ai.service';
import { parseAiTopic, parseChatId, parseChatTurn } from './ai.validation';
import { respondWithAiReply } from './ai.reply-transport';
import type { StudyPlan } from './ai.types';

export const listChats: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chats = await aiService.listChats(request.auth.userId);
    response.json({ success: true, data: { chats } });
  } catch (error) {
    next(error);
  }
};

export const createChat: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const topic = parseAiTopic(request.body?.topic);
    const chat = await aiService.createChat(request.auth.userId, topic);
    response.status(201).json({ success: true, data: { chat } });
  } catch (error) {
    next(error);
  }
};

export const getChat: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chatId = parseChatId(request.params.chatId);
    const chat = await aiService.getChat(request.auth.userId, chatId, request.query.include === 'destinations');
    response.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
};

export const deleteChat: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chatId = parseChatId(request.params.chatId);
    await aiService.deleteChat(request.auth.userId, chatId);
    response.json({ success: true, data: { chat_id: chatId, deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const sendMessage: RequestHandler = (request, response, next) =>
  respondWithAiReply(request, response, next, 201, 'ai_chat_stream_failed', (signal, onDraft) => {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chatId = parseChatId(request.params.chatId);
    const turn = parseChatTurn(request.body);
    return aiService.sendMessage(
      request.auth.userId,
      chatId,
      turn.message,
      turn.intent,
      turn.context,
      signal,
      onDraft,
    );
  });

export const getStudyPlan: RequestHandler = (request, response, next) =>
  respondWithAiReply<StudyPlan>(request, response, next, 200, 'ai_plan_stream_failed', (signal, onPlan) => {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    return aiService.getStudyPlan(request.auth.userId, signal, onPlan);
  }, (data) => ({ type: 'plan', data }));

export const getFeedback: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chatId = parseChatId(request.params.chatId);
    const feedback = await aiService.getFeedback(request.auth.userId, chatId);
    response.json({ success: true, data: { feedback } });
  } catch (error) {
    next(error);
  }
};
