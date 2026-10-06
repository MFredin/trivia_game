import express from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { TITLES, TITLE_BY_ID } from '../lib/titles.js';
import { grantTitle, listHolders, revokeTitle } from '../services/titles.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Who holds a system title, and who gave it to them.
router.get('/', async (req, res) => {
  const holders = await listHolders();
  return res.json({
    holders: holders.map((h) => ({ ...h, title_name: TITLE_BY_ID[h.title]?.name ?? h.title })),
    // What can be given, from the one catalogue, so this screen cannot offer a title that does not exist.
    available: TITLES.filter((t) => t.kind === 'system').map((t) => ({ id: t.id, name: t.name, description: t.description })),
  });
});

// A system title goes to a specific person, by an admin, and by nothing else. An earned title is not
// something to hand out: it follows from the achievement.
router.post('/', async (req, res) => {
  const { username, title } = req.body ?? {};
  if (typeof title !== 'string' || !TITLE_BY_ID[title]) return res.status(400).json({ error: 'invalid_title' });
  if (TITLE_BY_ID[title].kind !== 'system') return res.status(400).json({ error: 'not_a_system_title' });
  if (typeof username !== 'string' || username.trim() === '') return res.status(400).json({ error: 'invalid_username' });

  const result = await grantTitle(req.userId, username.trim(), title);
  if (!result) return res.status(404).json({ error: 'user_not_found' });
  return res.status(result.granted ? 201 : 200).json({ ok: true });
});

router.delete('/:username/:title', async (req, res) => {
  if (!(await revokeTitle(req.params.username, req.params.title))) return res.status(404).json({ error: 'title_not_found' });
  return res.status(204).end();
});

export default router;
