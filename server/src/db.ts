import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    content TEXT NOT NULL DEFAULT '',
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS document_shares (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    shared_with_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(document_id, shared_with_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );
`);

// Stable seed IDs — fixed so they don't change across restarts
const SEED_USERS = [
  { id: 'a1000000-0000-0000-0000-000000000001', email: 'alice@example.com', name: 'Alice Johnson', password: 'password123' },
  { id: 'b2000000-0000-0000-0000-000000000002', email: 'bob@example.com',   name: 'Bob Smith',     password: 'password123' },
  { id: 'c3000000-0000-0000-0000-000000000003', email: 'carol@example.com', name: 'Carol Williams', password: 'password123' },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (id, email, name, password) VALUES (?, ?, ?, ?)'
);
for (const u of SEED_USERS) {
  insertUser.run(u.id, u.email, u.name, u.password);
}

export default db;
