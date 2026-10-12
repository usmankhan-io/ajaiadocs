import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Stable test user IDs
const ALICE_ID = 'a1000000-0000-0000-0000-000000000001';
const BOB_ID   = 'b2000000-0000-0000-0000-000000000002';

function buildTestApp() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, password TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE documents (
      id TEXT PRIMARY KEY, title TEXT, content TEXT, owner_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE document_shares (
      id TEXT PRIMARY KEY, document_id TEXT, shared_with_id TEXT,
      permission TEXT DEFAULT 'view' CHECK (permission IN ('view','edit')),
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(document_id, shared_with_id)
    );
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY, document_id TEXT, filename TEXT, original_name TEXT,
      mime_type TEXT, size INTEGER, created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, unixepoch())').run(ALICE_ID, 'alice@test.com', 'Alice', 'pass');
  db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, unixepoch())').run(BOB_ID, 'bob@test.com', 'Bob', 'pass');

  const app = express();
  app.use(express.json());

  function auth(req: any, res: any, next: any) {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    req.userId = userId;
    next();
  }

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ? AND password = ?').get(email, password) as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ user });
  });

  app.get('/api/auth/users', auth, (_req, res) => {
    res.json(db.prepare('SELECT id, email, name FROM users').all());
  });

  app.get('/api/documents', auth, (req: any, res) => {
    const owned = db.prepare("SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.owner_id = ?").all(req.userId);
    const shared = db.prepare("SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id = d.owner_id JOIN document_shares ds ON ds.document_id = d.id WHERE ds.shared_with_id = ?").all(req.userId);
    res.json({ owned, shared });
  });

  app.post('/api/documents', auth, (req: any, res) => {
    const title = (req.body.title ?? 'Untitled').trim().slice(0, 500) || 'Untitled';
    const content = req.body.content ?? '';
    if (content.length > 2_000_000) return res.status(400).json({ error: 'Content too large' });
    const id = uuidv4();
    db.prepare('INSERT INTO documents (id, title, content, owner_id) VALUES (?, ?, ?, ?)').run(id, title, content, req.userId);
    const doc = db.prepare('SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?').get(id);
    res.status(201).json(doc);
  });

  app.post('/api/documents/:id/share', auth, (req: any, res) => {
    const { id } = req.params;
    const { email, permission = 'edit' } = req.body;
    if (!['edit', 'view'].includes(permission)) return res.status(400).json({ error: 'Invalid permission' });
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.owner_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const target = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
    if (!target) return res.status(404).json({ error: 'User not found' });
    db.prepare("INSERT INTO document_shares (id, document_id, shared_with_id, permission) VALUES (?, ?, ?, ?) ON CONFLICT(document_id, shared_with_id) DO UPDATE SET permission = excluded.permission").run(uuidv4(), id, target.id, permission);
    res.json({ success: true });
  });

  return { app, db };
}

describe('Auth', () => {
  let app: express.Express;
  beforeEach(() => { ({ app } = buildTestApp()); });

  it('POST /api/auth/login → 200 on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.com', password: 'pass' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@test.com');
  });

  it('POST /api/auth/login → 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login → 400 on missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.com' });
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/users → 401 without auth', async () => {
    const res = await request(app).get('/api/auth/users');
    expect(res.status).toBe(401);
  });
});

describe('Documents', () => {
  let app: express.Express;
  beforeEach(() => { ({ app } = buildTestApp()); });

  it('GET /api/documents → 401 without auth header', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('POST /api/documents → creates a document owned by caller', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('x-user-id', ALICE_ID)
      .send({ title: 'My Doc', content: '<p>Hello</p>' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My Doc');
    expect(res.body.owner_id).toBe(ALICE_ID);
  });

  it('GET /api/documents → lists owned and shared separately', async () => {
    await request(app).post('/api/documents').set('x-user-id', ALICE_ID).send({ title: 'Doc 1' });
    const res = await request(app).get('/api/documents').set('x-user-id', ALICE_ID);
    expect(res.status).toBe(200);
    expect(res.body.owned).toHaveLength(1);
    expect(res.body.shared).toHaveLength(0);
  });

  it('POST /api/documents/:id/share → shares with another user', async () => {
    const create = await request(app).post('/api/documents').set('x-user-id', ALICE_ID).send({ title: 'Shared' });
    const docId = create.body.id;

    const share = await request(app)
      .post(`/api/documents/${docId}/share`)
      .set('x-user-id', ALICE_ID)
      .send({ email: 'bob@test.com', permission: 'edit' });
    expect(share.status).toBe(200);

    const bobDocs = await request(app).get('/api/documents').set('x-user-id', BOB_ID);
    expect(bobDocs.body.shared).toHaveLength(1);
  });

  it('POST /api/documents/:id/share → rejects invalid permission value', async () => {
    const create = await request(app).post('/api/documents').set('x-user-id', ALICE_ID).send({ title: 'Doc' });
    const res = await request(app)
      .post(`/api/documents/${create.body.id}/share`)
      .set('x-user-id', ALICE_ID)
      .send({ email: 'bob@test.com', permission: 'admin' });
    expect(res.status).toBe(400);
  });

  it('POST /api/documents/:id/share → 403 when non-owner tries to share', async () => {
    const create = await request(app).post('/api/documents').set('x-user-id', ALICE_ID).send({ title: 'Private' });
    const res = await request(app)
      .post(`/api/documents/${create.body.id}/share`)
      .set('x-user-id', BOB_ID)
      .send({ email: 'alice@test.com' });
    expect(res.status).toBe(403);
  });
});
