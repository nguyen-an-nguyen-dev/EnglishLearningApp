import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './ai.controller';

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.get('/chats', controller.listChats);
aiRouter.post('/chats', controller.createChat);
aiRouter.get('/chats/:chatId', controller.getChat);
aiRouter.post('/chats/:chatId/messages', controller.sendMessage);
aiRouter.get('/chats/:chatId/feedback', controller.getFeedback);
