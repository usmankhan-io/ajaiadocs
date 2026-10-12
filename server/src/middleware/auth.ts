import { Request, Response, NextFunction } from 'express';
import db from '../db';

export interface AuthRequest extends Request {
  userId?: string;
  userName?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) as
    | { id: string; name: string }
    | undefined;

  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }

  req.userId = user.id;
  req.userName = user.name;
  return next();
}
