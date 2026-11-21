import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { securityHeaders } from './middleware/security-headers';
import { authRouter } from './modules/auth/auth.routes';
import { badgesRouter } from './modules/badges/badges.routes';
import { learningRouter } from './modules/learning/learning.routes';
import { rankingRouter } from './modules/ranking/ranking.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { speechRouter } from './modules/speech/speech.routes';
import { translationRouter } from './modules/translations/translations.routes';
import { videoRouter } from './modules/video/video.routes';
import { battleRouter } from './modules/battle/battle.routes';
import { gamificationRouter } from './modules/gamification/gamification.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { buddyRouter } from './modules/buddy/buddy.routes';
import { remindersRouter } from './modules/reminders/reminders.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { healthRouter } from './routes/health';

export const app = express();

app.use(requestId);
app.use(securityHeaders);
app.use(requestLogger);

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
	methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
app.use('/media', express.static('public'));
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/badges', badgesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/speech', speechRouter);
app.use('/api', translationRouter);
app.use('/api', videoRouter);
app.use('/api', battleRouter);
app.use('/api', gamificationRouter);
app.use('/api/buddy', buddyRouter);
app.use('/api', remindersRouter);
app.use('/api', analyticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', learningRouter);
app.use(notFoundHandler);
app.use(errorHandler);