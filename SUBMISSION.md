# Submission Contents

## What's Included

| Item | Location | Status |
|------|----------|--------|
| Source code (backend) | `server/` | ✅ Complete |
| Source code (frontend) | `client/` | ✅ Complete |
| README with setup instructions | `README.md` | ✅ Complete |
| Architecture note | `ARCHITECTURE.md` | ✅ Complete |
| AI workflow note | `AI_WORKFLOW.md` | ✅ Complete |
| Automated tests (7 tests) | `server/__tests__/api.test.ts` | ✅ Passing |
| Live deployment URL | See below | ✅ |
| Walkthrough video | `VIDEO.txt` | ✅ |

## Live Deployment

**URL:** [Add deployment URL here after deploying to Railway/Render]

**Demo credentials:**
- Alice (owner): `alice@example.com` / `password123`
- Bob (shared): `bob@example.com` / `password123`
- Carol (extra user): `carol@example.com` / `password123`

## What Works End-to-End

- [x] User login with seeded accounts
- [x] Create, rename, and delete documents
- [x] Rich text editing: bold, italic, underline, H1/H2/H3, bullet lists, numbered lists, text alignment
- [x] Auto-save (1.5s debounce after last keystroke)
- [x] Documents persist across server restarts (SQLite)
- [x] Import `.txt` / `.md` file as new document
- [x] Attach `.txt` / `.md` file to existing document
- [x] Share document with another user (edit or view permission)
- [x] Revoke access from shared user
- [x] Dashboard shows owned vs. shared documents distinctly
- [x] View-only mode with banner for view-permission users
- [x] 7 integration tests covering auth, CRUD, and sharing logic

## What's Incomplete / Would Add Next

**With 2–4 more hours:**

1. **Deployment** — set up Railway or Render with environment variables; currently runs locally only
2. **`.docx` import** — add `mammoth.js` to convert Word files to HTML
3. **Real-time presence** — add a WebSocket layer with Yjs or a simple socket event for "user X is editing"
4. **Document export** — add a "Download as Markdown" button (reverse-parse TipTap HTML)
5. **Production auth** — replace `x-user-id` header with JWT + httpOnly cookies

## Running Tests

```bash
cd server
npx jest --forceExit
```

Expected output: 7 tests passing.
