import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/me', authenticate, authController.me);