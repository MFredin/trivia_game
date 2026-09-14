import express from 'express';
import cors from 'cors';
import sessionsRouter from './routes/sessions.js';
import leaderboardRouter from './routes/leaderboard.js';
import categoriesRouter from './routes/categories.js';
import authRouter from './routes/auth.js';
import friendsRouter from './routes/friends.js';
import duelsRouter from './routes/duels.js';
import achievementsRouter from './routes/achievements.js';
import suggestionsRouter from './routes/suggestions.js';

export function createApp() {
  const app = express();
  // Railway sits behind a proxy — without this, req.ip is the proxy's own address for every
  // request, and the rate limiter would key everyone together. Harmless locally: with no
  // proxy in front, there's no X-Forwarded-For to trust and req.ip falls back to the socket.
  app.set('trust proxy', 1);
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
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/suggestions', suggestionsRouter);

  return app;
}
