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
import previewRouter from './routes/preview.js';
import profileRouter from './routes/profile.js';
import challengesRouter from './routes/challenges.js';
import activityRouter from './routes/activity.js';
import feedbackRouter from './routes/feedback.js';

export function createApp() {
  const app = express();
  // Railway sits behind a proxy — without this, req.ip is the proxy's own address for every
  // request, and the rate limiter would key everyone together. Harmless locally: with no
  // proxy in front, there's no X-Forwarded-For to trust and req.ip falls back to the socket.
  app.set('trust proxy', 1);
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.use(cors(allowedOrigin ? { origin: allowedOrigin.split(',') } : undefined));
  app.use(express.json());

  // Railway injects RAILWAY_GIT_COMMIT_SHA into every build from a connected repo, so the
  // running service can say which commit it is without anyone having to correlate deploy
  // timestamps by hand. Reporting it here is what makes "is this build actually live?"
  // answerable from outside, which an audit otherwise has to guess at.
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA ?? null;
  const startedAt = new Date().toISOString();
  app.get('/api/health', (req, res) =>
    res.json({
      ok: true,
      commit: commit ? commit.slice(0, 7) : 'dev',
      commit_full: commit,
      branch: process.env.RAILWAY_GIT_BRANCH ?? null,
      started_at: startedAt,
    }),
  );
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/duels', duelsRouter);
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/suggestions', suggestionsRouter);
  app.use('/api/preview', previewRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/challenges', challengesRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/feedback', feedbackRouter);

  return app;
}
