import express from 'express';
import { getAllQuestions } from '../repo/questions.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const questions = await getAllQuestions();
  const categories = [...new Set(questions.map((q) => q.category))].sort();
  return res.json({ categories });
});

export default router;
