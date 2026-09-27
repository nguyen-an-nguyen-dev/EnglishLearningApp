import { Router } from 'express';
import { pool } from '../db/pool';
import { HttpError } from '../middleware/error-handler';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response, next) => {
  try {
    await pool.execute('SELECT ?', [1]);
    response.json({
      success: true,
      data: { status: 'ok' },
    });
  } catch {
    next(new HttpError(503, 'Database unavailable'));
  }
});