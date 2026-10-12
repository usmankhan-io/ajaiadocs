# AjaiaDocs — Lightweight Collaborative Document Editor

A full-stack document editing application with rich text formatting, file import, and document sharing.

## Demo Accounts

| Name | Email | Password |
|------|-------|----------|
| Alice Johnson | alice@example.com | password123 |
| Bob Smith | bob@example.com | password123 |
| Carol Williams | carol@example.com | password123 |

Use different browser tabs or profiles to test the sharing flow.

## Features

- **Document editor** — TipTap rich text editor with bold, italic, underline, headings (H1–H3), bullet/numbered lists, text alignment, undo/redo
- **Auto-save** — content saves automatically 1.5s after you stop typing
- **File import** — upload `.txt` or `.md` files to create a new document
- **File attachments** — attach `.txt` or `.md` files to any document (5MB limit)
- **Sharing** — owners can share documents with other users as "edit" or "view" permission
- **View-only mode** — viewers see a read-only editor with a banner
- **Persistence** — SQLite database, survives server restarts

## Local Setup

### Prerequisites
- Node.js 18+ 
- npm 9+

### 1. Install server dependencies

```bash
cd server
npm install
npm approve-scripts better-sqlite3   # allow native build
npm install                           # re-run after approval
```

### 2. Build and start the server

```bash
cd server
npm run build
npm start
# Server runs at http://localhost:3001
```

Or for development with hot-reload:
```bash
npm run dev
```

### 3. Install and start the client

```bash
cd client
npm install
npm start
# App opens at http://localhost:3000
```

The client reads `REACT_APP_API_URL` (defaults to `http://localhost:3001`).

### 4. Run tests

```bash
cd server
npx jest --forceExit
```

## Project Structure

```
submission-work/
├── server/
│   ├── src/
│   │   ├── index.ts          # Express app entry point
│   │   ├── db.ts             # SQLite setup and seed
│   │   ├── middleware/
│   │   │   └── auth.ts       # x-user-id header auth
│   │   └── routes/
│   │       ├── auth.ts       # Login + list users
│   │       ├── documents.ts  # CRUD + sharing
│   │       └── upload.ts     # File import + attach
│   ├── __tests__/
│   │   └── api.test.ts       # 7 integration tests
│   └── data.db               # SQLite file (auto-created)
├── client/
│   └── src/
│       ├── App.tsx
│       ├── api.ts            # API client (axios)
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   └── EditorPage.tsx
│       └── components/
│           └── ShareModal.tsx
├── README.md
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
└── SUBMISSION.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/users | List all users |
| GET | /api/documents | List owned + shared docs |
| POST | /api/documents | Create document |
| GET | /api/documents/:id | Get document |
| PUT | /api/documents/:id | Update title/content |
| DELETE | /api/documents/:id | Delete (owner only) |
| POST | /api/documents/:id/share | Share with user |
| DELETE | /api/documents/:id/share/:shareId | Revoke share |
| POST | /api/upload/import | Import file as new doc |
| POST | /api/upload/attach/:docId | Attach file to doc |

## Supported File Types for Upload

`.txt` and `.md` only. Maximum 5MB per file.
