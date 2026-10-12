import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { queries } from '../queries';
import { escapeHtml, sanitizeTitle, LIMITS } from '../validation';
import { param } from '../middleware/params';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Extension whitelist — MIME type alone is not trusted; clients can spoof it
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => cb(null, `${uuidv4()}.bin`), // generic extension prevents execution
});

const upload = multer({
  storage,
  limits: { fileSize: LIMITS.CONTENT_MAX },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .md files are supported'));
    }
  },
});

const router = Router();

// Import file as new document
router.post('/import', requireAuth, upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.userId!;
  const filePath = req.file.path;

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(filePath, 'utf-8');
  } catch {
    fs.unlink(filePath, () => {});
    return res.status(500).json({ error: 'Failed to read uploaded file' });
  } finally {
    // Always remove temp file
    fs.unlink(filePath, () => {});
  }

  const originalName = req.file.originalname;
  const rawTitle = path.basename(originalName, path.extname(originalName));
  const title = sanitizeTitle(rawTitle) ?? 'Imported Document';

  // Escape all content before inserting into HTML to prevent stored XSS
  const htmlContent = rawContent
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, htmlContent, userId, now, now);

  return res.status(201).json(queries.getDoc(id));
});

// Attach file to existing document (metadata only — no file serving)
router.post('/attach/:docId', requireAuth, upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.userId!;
  const docId = param(req.params.docId);

  const doc = queries.getDoc(docId);
  if (!doc) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Document not found' });
  }

  const isOwner = doc.owner_id === userId;
  const share = db.prepare(
    'SELECT permission FROM document_shares WHERE document_id = ? AND shared_with_id = ?'
  ).get(docId, userId) as { permission: string } | undefined;

  if (!isOwner && !share) {
    fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: 'Access denied' });
  }

  const attachId = uuidv4();
  db.prepare(`
    INSERT INTO attachments (id, document_id, filename, original_name, mime_type, size)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(attachId, docId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);

  return res.status(201).json({
    id: attachId,
    original_name: req.file.originalname,
    mime_type: req.file.mimetype,
    size: req.file.size,
  });
});

export default router;
