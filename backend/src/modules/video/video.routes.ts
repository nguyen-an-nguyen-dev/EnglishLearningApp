import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './video.controller';

export const videoRouter = Router();

videoRouter.get('/videos', authenticate, controller.getVideos);
videoRouter.post('/videos/import', authenticate, controller.importVideo);
videoRouter.get('/videos/:videoId', authenticate, controller.getVideo);
videoRouter.delete('/videos/:videoId', authenticate, controller.deleteVideo);
videoRouter.post('/videos/:videoId/progress', authenticate, controller.saveProgress);
videoRouter.post('/videos/:videoId/complete', authenticate, controller.completeVideo);

videoRouter.get('/vocabulary', authenticate, controller.getSavedWords);
videoRouter.post('/vocabulary', authenticate, controller.saveWord);
videoRouter.delete('/vocabulary/:word', authenticate, controller.deleteSavedWord);
