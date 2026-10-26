import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './translations.controller';
import { uploadTxtFile } from './translations.upload';

export const translationRouter = Router();

const parseMultipartFile: RequestHandler = (request, response, next) => {
  if (request.is('multipart/form-data')) {
    uploadTxtFile(request, response, next);
    return;
  }
  next();
};

translationRouter.get('/translations', authenticate, controller.listHistory);
translationRouter.post('/translate', authenticate, controller.translateText);
translationRouter.post('/translate/file', authenticate, parseMultipartFile, controller.translateFile);
