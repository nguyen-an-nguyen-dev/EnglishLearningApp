import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './reminders.controller';

export const remindersRouter = Router();

remindersRouter.use(authenticate);
remindersRouter.get('/reminders', controller.listReminders);
remindersRouter.post('/reminders', controller.createReminder);
remindersRouter.post('/reminders/:reminderId/acknowledge', controller.acknowledgeReminder);
remindersRouter.delete('/reminders/:reminderId', controller.dismissReminder);
