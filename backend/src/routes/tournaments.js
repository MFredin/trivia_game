// Knockout tournaments among friends (/api/tournaments), each match played on the players' own time inside a deadline.
//
//   POST   /                       create one (the creator is its first player)
//   POST   /join                   join by code
//   GET    /mine                   the tournaments I am in, with what I have to do next
//   GET    /:code                  one tournament: players, rounds, matches
//   POST   /:code/start            seed the players and open round one (creator only)
//   POST   /:code/leave            leave, while it is still open
//   POST   /:code/cancel           the creator, or a moderator
//   DELETE /:code/players/:name    the creator removes a player, while it is still open
//   POST   /matches/:id/play       start my run of a match
//
// A tournament is found by its code, and only by people in it: everyone else is told "not found", the same answer as for a
// code that does not exist, so a code cannot be used to find out whether a tournament is there. Rules live in lib/ and
// services/; these routes only turn their answers into statuses.

import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { canReviewReports, roleOf } from '../lib/roles.js';
import {
  cancelTournament, createTournament, getTournament, joinTournament, leaveTournament, listMine, removePlayer, startMatchRun,
  startTournament,
} from '../services/tournaments.js';

const router = express.Router();
router.use(requireAuth);

const STATUS = {
  not_found: 404, match_not_found: 404, player_not_found: 404,
  not_creator: 403, cannot_join: 403, challenges_off: 403,
  not_open: 409, full: 409, already_joined: 409, already_started: 409, too_few_players: 409, too_many_players: 409,
  already_over: 409, match_not_open: 409, match_closed: 409, creator_cannot_leave: 409,
  no_eligible_questions: 400,
  internal_error: 500,
};
const failure = (res, error) => res.status(STATUS[error] ?? 400).json({ error });

const CODE = /^[0-9a-f]{8}$/;
// A code that cannot be one is the same "not found" as a code nobody has, without a query.
const codeOf = (req) => (CODE.test(req.params.code) ? req.params.code : null);

router.post('/', async (req, res) => {
  const result = await createTournament(req.userId, req.body ?? {});
  if (result.error) return failure(res, result.error);
  return res.status(201).json({ code: result.tournament.code });
});

router.post('/join', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toLowerCase() : '';
  if (!CODE.test(code)) return failure(res, 'not_found');
  const result = await joinTournament(req.userId, code);
  if (result.error) return failure(res, result.error);
  return res.json({ code });
});

router.get('/mine', async (req, res) => res.json({ tournaments: await listMine(req.userId) }));

// Registered before the /:code routes below, though its path is longer than theirs and could not be mistaken for one.
router.post('/matches/:id/play', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return failure(res, 'match_not_found');
  const result = await startMatchRun(req.userId, id);
  if (result.error) return failure(res, result.error);
  return res.status(201).json(result.run);
});

router.get('/:code', async (req, res) => {
  const code = codeOf(req);
  if (!code) return failure(res, 'not_found');
  const result = await getTournament(req.userId, code);
  return result.error ? failure(res, result.error) : res.json(result.tournament);
});

router.post('/:code/start', async (req, res) => {
  const code = codeOf(req);
  if (!code) return failure(res, 'not_found');
  const result = await startTournament(req.userId, code);
  if (result.error) return failure(res, result.error);
  return res.json({ code, status: 'running' });
});

router.post('/:code/leave', async (req, res) => {
  const code = codeOf(req);
  if (!code) return failure(res, 'not_found');
  const result = await leaveTournament(req.userId, code);
  return result.error ? failure(res, result.error) : res.json({ ok: true });
});

router.post('/:code/cancel', async (req, res) => {
  const code = codeOf(req);
  if (!code) return failure(res, 'not_found');
  const { rows } = await pool.query('SELECT is_admin, is_moderator FROM users WHERE id = $1', [req.userId]);
  const result = await cancelTournament(req.userId, code, { isStaff: canReviewReports(roleOf(rows[0])) });
  return result.error ? failure(res, result.error) : res.json({ ok: true });
});

router.delete('/:code/players/:username', async (req, res) => {
  const code = codeOf(req);
  if (!code) return failure(res, 'not_found');
  const result = await removePlayer(req.userId, code, req.params.username);
  return result.error ? failure(res, result.error) : res.json({ ok: true });
});

export default router;
