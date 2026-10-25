import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import * as aiService from './ai.service';
import { parseAiTopic, parseChatId, parseUserMessage } from './ai.validation';

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
    const chat = await aiService.getChat(request.auth.userId, chatId);
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

export const sendMessage: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const chatId = parseChatId(request.params.chatId);
    const message = parseUserMessage(request.body);
    const data = await aiService.sendMessage(request.auth.userId, chatId, message);
    response.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

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
