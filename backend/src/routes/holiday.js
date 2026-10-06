import express from 'express';
import { activeOverlay, overlayByKey } from '../lib/holidayOverlay.js';

const router = express.Router();

// Which holiday overlay is on today, or null. Public: the sign-in screen is the first thing a visitor sees, and a
// decorated page that waits for an account is a page that looks undecorated for exactly the people it is for.
//
// Outside production a request may name an overlay to treat as active (?force=halloween), so a developer or a browser
// test can see one out of its window. It is ignored in production, so it can never switch a holiday on for players.
router.get('/', (req, res) => {
  const forced = process.env.NODE_ENV !== 'production' && overlayByKey(req.query.force);
  return res.json({ overlay: forced || activeOverlay() });
});

export default router;
