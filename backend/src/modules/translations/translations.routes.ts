import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './translations.controller';
import { uploadTxtFile } from './translations.upload';

export const translationRouter = Router();

translationRouter.get('/translations', authenticate, controller.listHistory);
translationRouter.post('/translate', authenticate, controller.translateText);
translationRouter.post('/translate/file', authenticate, uploadTxtFile, controller.translateFile);
