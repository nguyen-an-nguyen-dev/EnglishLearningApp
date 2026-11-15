import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './gamification.controller';

export const gamificationRouter = Router();

gamificationRouter.get('/wallet', authenticate, controller.getWallet);

gamificationRouter.get('/shop', authenticate, controller.getShop);
gamificationRouter.post('/shop/items/:itemId/purchase', authenticate, controller.purchaseItem);
gamificationRouter.post('/shop/items/:itemId/equip', authenticate, controller.equipItem);
gamificationRouter.post('/shop/slots/:slot/unequip', authenticate, controller.unequipSlot);

gamificationRouter.get('/rewards', authenticate, controller.getRewards);
gamificationRouter.post('/rewards/quests/:code/claim', authenticate, controller.claimQuest);

gamificationRouter.get('/league', authenticate, controller.getLeague);
