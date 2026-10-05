// GET /api/categories: the categories that exist in the question bank, for the filter on the start screen. Derived
// from the bank rather than listed anywhere, so a category appears as soon as its first question does. Public.

import express from 'express';
import { getAllQuestions } from '../repo/questions.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const questions = await getAllQuestions();
  const categories = [...new Set(questions.map((q) => q.category))].sort();
  return res.json({ categories });
});

export default router;
