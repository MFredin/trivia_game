import express from 'express';
import cors from 'cors';
import sessionsRouter from './routes/sessions.js';
import leaderboardRouter from './routes/leaderboard.js';
import categoriesRouter from './routes/categories.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/categories', categoriesRouter);

  return app;
}
