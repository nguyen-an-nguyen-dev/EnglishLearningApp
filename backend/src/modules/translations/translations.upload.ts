import path from 'node:path';
import multer, { type MulterError } from 'multer';
import type { RequestHandler } from 'express';
import { HttpError } from '../../middleware/error-handler';
import { MAX_TRANSLATION_FILE_BYTES } from './translations.validation';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRANSLATION_FILE_BYTES, files: 1, fields: 2, parts: 3 },
  fileFilter: (_request, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.txt') {
      callback(new HttpError(422, 'Only .txt files are supported.'));
      return;
    }
    if (file.mimetype !== 'text/plain' && file.mimetype !== 'application/octet-stream') {
      callback(new HttpError(422, 'The selected file must be a plain text .txt file.'));
      return;
    }
    callback(null, true);
  },
});

export const uploadTxtFile: RequestHandler = (request, response, next) => {
  parser.single('file')(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    if ((error as MulterError).name === 'MulterError') {
      const multerError = error as MulterError;
      next(new HttpError(
        multerError.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
        multerError.code === 'LIMIT_FILE_SIZE'
          ? `File is too large. Maximum size is ${MAX_TRANSLATION_FILE_BYTES / 1024} KB.`
          : `Upload exactly one .txt file no larger than ${MAX_TRANSLATION_FILE_BYTES / 1024} KB.`,
      ));
      return;
    }
    next(error);
  });
};
