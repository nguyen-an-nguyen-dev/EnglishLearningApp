import { TextDecoder } from 'node:util';
import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import { MAX_TRANSLATION_FILE_BYTES } from './translations.validation';
import * as service from './translations.service';
import { parseLanguages } from './translations.validation';

export const translateText: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const { sourceLanguage, targetLanguage } = parseLanguages(
      request.body?.sourceLanguage,
      request.body?.targetLanguage,
    );
    const result = await service.translateText(
      request.auth.userId,
      request.body?.text,
      sourceLanguage,
      targetLanguage,
    );
    response.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const translateFile: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const { sourceLanguage, targetLanguage } = parseLanguages(
      request.body?.sourceLanguage,
      request.body?.targetLanguage,
    );
    const file = request.file;
    if (!file) throw new HttpError(422, 'Choose a .txt file to translate.');
    if (file.size > MAX_TRANSLATION_FILE_BYTES) {
      throw new HttpError(413, 'File is too large. Maximum size is 100 KB.');
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new HttpError(422, 'The .txt file must use valid UTF-8 text.');
    }
    if (text.includes('\u0000')) throw new HttpError(422, 'The file is not valid plain text.');
    const result = await service.translateText(
      request.auth.userId,
      text,
      sourceLanguage,
      targetLanguage,
      file.originalname.slice(0, 255),
    );
    response.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listHistory: RequestHandler = async (request, response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication required.');
    const translations = await service.listHistory(request.auth.userId);
    response.json({ success: true, data: { translations } });
  } catch (error) {
    next(error);
  }
};
