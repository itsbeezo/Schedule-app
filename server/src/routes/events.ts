import { Router } from 'express';
import { db } from '../db';
const router = Router();

// GET all events
router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM events');
  res.json(rows);
});

// POST new event
router.post('/', async (req, res) => {
  const { title, start, end } = req.body;
  const { rows } = await db.query(
    'INSERT INTO events(title, start, end) VALUES($1, $2, $3) RETURNING *',
    [title, start, end]
  );
  res.status(201).json(rows[0]);
});

export default router;
