import './lib/asyncErrors.js';
import './services/retention.js';
import express from 'express';
import cors from 'cors';
import { sentryRequestWatcher, attachSentryErrorHandler } from './lib/sentry.js';
import { errorHandler, notFound } from './lib/errors.js';
import { securityHeaders } from './lib/securityHeaders.js';
import { writeLimit } from './lib/writeLimit.js';
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
import tournamentsRouter from './routes/tournaments.js';
import activityRouter from './routes/activity.js';
import feedbackRouter from './routes/feedback.js';
import accountRouter from './routes/account.js';
import accountProfileRouter from './routes/accountProfile.js';
import blocksRouter from './routes/blocks.js';
import reportsRouter from './routes/reports.js';
import moderationRouter from './routes/moderation.js';
import owlPostRouter from './routes/owlPost.js';
import adminTitlesRouter from './routes/adminTitles.js';
import adminTeamRouter from './routes/adminTeam.js';
import accountRecoveryRouter from './routes/accountRecovery.js';

export function createApp() {
  const app = express();
  // Railway sits behind a proxy — without this, req.ip is the proxy's own address for every
  // request, and the rate limiter would key everyone together. Harmless locally: with no
  // proxy in front, there's no X-Forwarded-For to trust and req.ip falls back to the socket.
  app.set('trust proxy', 1);
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  // Without ALLOWED_ORIGIN every website may call this API from a visitor's browser. Right for local
  // development; in production it is a misconfiguration, so say so in the log rather than fail silently open.
  if (!allowedOrigin && process.env.NODE_ENV === 'production') {
    console.warn('ALLOWED_ORIGIN is not set: this API accepts requests from any website. Set it to the frontend URL.');
  }
  app.use(securityHeaders);
  app.use(cors(allowedOrigin ? { origin: allowedOrigin.split(',') } : undefined));
  // The default is 100kb; stated so nobody has to know that. Nothing here is larger than a message or a question.
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', writeLimit);
  // No-op unless SENTRY_DSN is set — see lib/sentry.js.
  app.use(sentryRequestWatcher);

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
  app.use('/api/tournaments', tournamentsRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/account', accountProfileRouter);
  app.use('/api/blocks', blocksRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/moderation', moderationRouter);
  app.use('/api/owlpost', owlPostRouter);
  app.use('/api/admin/titles', adminTitlesRouter);
  app.use('/api/admin/team', adminTeamRouter);
  app.use('/api/auth', accountRecoveryRouter);

  // Mounted after every route, as Express requires for error-handling middleware. No-op
  // unless SENTRY_DSN is set — see lib/sentry.js. Reports and then hands off to the default
  // handler; it never answers the client itself.
  attachSentryErrorHandler(app);

  // After Sentry has seen an error, answer it. These two must stay last.
  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
