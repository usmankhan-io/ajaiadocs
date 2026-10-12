import { Router, Request, Response } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { isValidEmail } from '../validation';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.prepare('SELECT id, email, name FROM users WHERE email = ? AND password = ?')
    .get(email, password) as { id: string; email: string; name: string } | undefined;

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({ user });
});

// Requires auth — callers need a valid session to enumerate users for sharing
router.get('/users', requireAuth, (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, email, name FROM users').all();
  return res.json(users);
});

export default router;
