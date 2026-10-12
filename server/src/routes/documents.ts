import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { queries, DocRow } from '../queries';
import {
  sanitizeTitle,
  isValidContent,
  isValidEmail,
  isValidPermission,
} from '../validation';
import { param } from '../middleware/params';

const router = Router();

function hasAccess(doc: DocRow, userId: string): boolean {
  if (doc.owner_id === userId) return true;
  const share = db.prepare(
    'SELECT id FROM document_shares WHERE document_id = ? AND shared_with_id = ?'
  ).get(doc.id, userId);
  return share !== undefined;
}

function canEdit(doc: DocRow, userId: string): boolean {
  if (doc.owner_id === userId) return true;
  const share = db.prepare(
    'SELECT permission FROM document_shares WHERE document_id = ? AND shared_with_id = ?'
  ).get(doc.id, userId) as { permission: string } | undefined;
  return share?.permission === 'edit';
}

// List documents (owned + shared)
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const owned = db.prepare<[string]>(`
    SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at,
           u.name AS owner_name, 'owner' AS role
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    WHERE d.owner_id = ?
    ORDER BY d.updated_at DESC
  `).all(userId);

  const shared = db.prepare<[string]>(`
    SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at,
           u.name AS owner_name, ds.permission AS role
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    JOIN document_shares ds ON ds.document_id = d.id
    WHERE ds.shared_with_id = ?
    ORDER BY d.updated_at DESC
  `).all(userId);

  return res.json({ owned, shared });
});

// Get single document
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = param(req.params.id);

  const doc = queries.getDoc(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (!hasAccess(doc, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const isOwner = doc.owner_id === userId;
  const shareRow = !isOwner
    ? (db.prepare('SELECT permission FROM document_shares WHERE document_id = ? AND shared_with_id = ?')
        .get(id, userId) as { permission: string })
    : null;

  const shares = isOwner ? queries.getShares(id) : [];
  const attachments = queries.getAttachments(id);

  return res.json({
    ...doc,
    role: isOwner ? 'owner' : shareRow!.permission,
    shares,
    attachments,
  });
});

// Create document
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rawTitle = req.body.title ?? 'Untitled Document';
  const rawContent = req.body.content ?? '';

  const title = sanitizeTitle(rawTitle) ?? 'Untitled Document';
  if (!isValidContent(rawContent)) {
    return res.status(400).json({ error: 'Content too large' });
  }

  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, rawContent, userId, now, now);

  return res.status(201).json(queries.getDoc(id));
});

// Update document
router.put('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = param(req.params.id);

  const doc = queries.getDoc(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!canEdit(doc, userId)) return res.status(403).json({ error: 'No edit permission' });

  const { title: rawTitle, content: rawContent } = req.body;
  const fieldsToSet: Record<string, string | number> = {};

  if (rawTitle !== undefined) {
    const title = sanitizeTitle(rawTitle);
    if (!title) return res.status(400).json({ error: 'Title must be 1–500 characters' });
    fieldsToSet.title = title;
  }
  if (rawContent !== undefined) {
    if (!isValidContent(rawContent)) return res.status(400).json({ error: 'Content too large' });
    fieldsToSet.content = rawContent;
  }
  if (Object.keys(fieldsToSet).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  fieldsToSet.updated_at = Math.floor(Date.now() / 1000);

  const setClauses = Object.keys(fieldsToSet).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fieldsToSet), id];
  db.prepare(`UPDATE documents SET ${setClauses} WHERE id = ?`).run(...values);

  return res.json(queries.getDoc(id));
});

// Delete document
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = param(req.params.id);

  const doc = queries.getDoc(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== userId) return res.status(403).json({ error: 'Only owner can delete' });

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return res.json({ success: true });
});

// Share document
router.post('/:id/share', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = param(req.params.id);
  const { email, permission = 'edit' } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!isValidPermission(permission)) {
    return res.status(400).json({ error: 'Permission must be "edit" or "view"' });
  }

  const doc = queries.getDoc(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== userId) return res.status(403).json({ error: 'Only owner can share' });

  const targetUser = db.prepare('SELECT id, name, email FROM users WHERE email = ?')
    .get(email) as { id: string; name: string; email: string } | undefined;
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot share with yourself' });

  db.prepare(`
    INSERT INTO document_shares (id, document_id, shared_with_id, permission)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(document_id, shared_with_id) DO UPDATE SET permission = excluded.permission
  `).run(uuidv4(), id, targetUser.id, permission);

  return res.json({ success: true, sharedWith: targetUser, permission });
});

// Revoke share
router.delete('/:id/share/:shareId', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = param(req.params.id);
  const shareId = param(req.params.shareId);

  const doc = queries.getDoc(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== userId) return res.status(403).json({ error: 'Only owner can revoke' });

  db.prepare('DELETE FROM document_shares WHERE id = ? AND document_id = ?').run(shareId, id);
  return res.json({ success: true });
});

export default router;
