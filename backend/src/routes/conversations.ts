import { Router } from 'express';
import { getState } from '../linkedin/automation';

export const conversationsRouter = Router();

conversationsRouter.get('/', (_req, res) => {
  const { conversations } = getState();
  res.json({ conversations });
});
