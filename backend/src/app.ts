import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { learningRouter } from './modules/learning/learning.routes';
import { healthRouter } from './routes/health';

export const app = express();

app.use(cors({
	origin: (origin, callback) => {
		if (
			!origin ||
			env.corsOrigins.includes(origin) ||
			process.env.NODE_ENV !== 'production'
		) {
			callback(null, true);
		} else {
			callback(new Error('Origin not allowed.'));
		}
	},
	allowedHeaders: ['Content-Type', 'Authorization'],
	methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', learningRouter);
app.use(notFoundHandler);
app.use(errorHandler);