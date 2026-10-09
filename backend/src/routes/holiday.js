import express from 'express';
import { activeOverlay, overlayByKey } from '../lib/holidayOverlay.js';
import { requireAuth } from '../middleware/auth.js';
import { unlockAchievement } from '../services/achievements.js';

const router = express.Router();

// Which holiday overlay is on today, or null. Public: the sign-in screen is the first thing a visitor sees, and a
// decorated page that waits for an account is a page that looks undecorated for exactly the people it is for.
//
// Outside production a request may name an overlay to treat as active (?force=halloween), so a developer or a browser
// test can see one out of its window. It is ignored in production, so it can never switch a holiday on for players.
const todaysOverlay = (req) => (process.env.NODE_ENV !== 'production' && overlayByKey(req.query.force)) || activeOverlay();

router.get('/', (req, res) => res.json({ overlay: todaysOverlay(req) }));

// A bat flies across the page while Halloween is on, and catching one unlocks an achievement. The page says it caught one; this checks that
// there was a Halloween to catch it in, using the same date rule (and the same development-only force) as the overlay itself, and unlocks
// once. Nothing is returned that a player could use: `unlocked` says only whether this catch was the first, and the toast arrives over the
// socket like every other achievement.
router.post('/bat', requireAuth, async (req, res) => {
  if (todaysOverlay(req) !== 'halloween') return res.status(404).json({ error: 'not_in_season' });
  const unlocked = await unlockAchievement(req.userId, 'halloween_bat');
  return res.json({ unlocked });
});

export default router;
