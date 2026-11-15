import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './reminders.controller';

export const remindersRouter = Router();

remindersRouter.get('/reminders', authenticate, controller.listReminders);
remindersRouter.post('/reminders', authenticate, controller.createReminder);
remindersRouter.post('/reminders/:reminderId/acknowledge', authenticate, controller.acknowledgeReminder);
remindersRouter.delete('/reminders/:reminderId', authenticate, controller.dismissReminder);
