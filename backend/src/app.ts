import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';

export const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);