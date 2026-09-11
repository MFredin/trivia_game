import express from 'express';
import cors from 'cors';
import sessionsRouter from './routes/sessions.js';
import leaderboardRouter from './routes/leaderboard.js';
import categoriesRouter from './routes/categories.js';
import authRouter from './routes/auth.js';
import friendsRouter from './routes/friends.js';
import duelsRouter from './routes/duels.js';

export function createApp() {
  const app = express();
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.use(cors(allowedOrigin ? { origin: allowedOrigin.split(',') } : undefined));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/duels', duelsRouter);

  return app;
}
