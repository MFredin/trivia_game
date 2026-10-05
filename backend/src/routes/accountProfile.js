import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { USER_COLUMNS, userView } from '../lib/userView.js';
import { FAVORITE_BOOKS, MAX_PINNED_ACHIEVEMENTS } from '../lib/profileFields.js';
import { BIO_MAX_LENGTH } from '../lib/bioFilter.js';
import { categoryNames, describeLocks, earnedAchievements, validateProfileUpdate } from '../services/profileCustomization.js';
import { describeTitles } from '../services/titles.js';

const router = express.Router();

router.use(requireAuth);

// Saving a profile is the only way a player's own words reach other people, so it is throttled
// per player. Generous for a person fiddling with an avatar; slow for a script trying phrasings
// until one gets past the bio filter.
const profileRateLimit = rateLimit({ max: 40, windowMs: 60 * 60 * 1000, keyFn: (req) => `profile:${req.userId}` });

// Everything the Edit Profile screen needs that is not on the user: which avatar choices are
// earned and whether this player has earned them, which achievements they can pin, and the lists
// the pickers offer.
router.get('/customization', async (req, res) => {
  const earned = await earnedAchievements(req.userId);
  return res.json({
    locks: describeLocks(earned),
    earned,
    titles: await describeTitles(req.userId),
    books: FAVORITE_BOOKS,
    subjects: await categoryNames(),
    limits: { bio: BIO_MAX_LENGTH, pinned: MAX_PINNED_ACHIEVEMENTS },
  });
});

router.patch('/profile', profileRateLimit, async (req, res) => {
  const { rows: currentRows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.userId]);
  const { updates, error } = await validateProfileUpdate(req.userId, currentRows[0], req.body);
  if (error) return res.status(error.status).json(error.body);

  const columns = Object.keys(updates);
  if (columns.length > 0) {
    const sets = columns.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE users SET ${sets} WHERE id = $1`, [req.userId, ...columns.map((c) => updates[c])]);
  }
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.userId]);
  return res.json({ user: userView(rows[0]) });
});

export default router;
