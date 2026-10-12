# Architecture Notes

## Stack Choice

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript | Industry standard, component model suits an editor app |
| Editor | TipTap | Best-in-class ProseMirror wrapper; simpler API than Slate, richer than Quill |
| Backend | Node.js + Express | Fast to scaffold, TypeScript types align with frontend |
| Database | SQLite (better-sqlite3) | Zero-setup, file-based, survives restarts — ideal for a reviewable demo |
| Auth | Header-based mocked auth | Keeps scope reasonable without JWT complexity |

## What I Prioritized

**1. Editing experience first.**  
The quality of the editor is the core product. TipTap gives headings, lists, bold/italic/underline, and text alignment out of the box. Auto-save with a debounce means users never lose work.

**2. Sharing with clear ownership semantics.**  
Documents list separately as "owned" vs "shared" on the dashboard. The editor shows a view-only banner when you lack edit permission. Owners can grant/revoke access per-user.

**3. File upload as a natural entry point.**  
Import converts `.txt`/`.md` to a rich-text document. Attach stores files against a document (metadata only shown in sidebar). Both flows surface supported formats clearly in the UI.

**4. Persistence without complexity.**  
SQLite keeps the reviewer experience simple — no Docker, no credentials, no external service. The DB file (`data.db`) is created automatically on first run and seeds three users.

## What I Explicitly Cut

- **Real authentication** — JWT or session cookies would be correct for production. The mocked header auth (`x-user-id`) is intentional to keep scope tight and let reviewers test the sharing flow easily.
- **Real-time collaboration** — WebSocket presence/cursors are a natural stretch goal. The auto-save architecture could support CRDT conflict resolution (Yjs) later.
- **Rich file import** — `.docx` import would require `mammoth.js`; I scoped to `.txt`/`.md` to avoid the complexity while still demonstrating the full upload pipeline.
- **Pagination/search** — the dashboard lists all documents. A production app would paginate.
- **Export** — export to PDF or markdown is a reasonable stretch goal; not implemented.

## Data Model

```
users (id, email, name, password, created_at)
documents (id, title, content, owner_id, created_at, updated_at)
document_shares (id, document_id, shared_with_id, permission, created_at)
attachments (id, document_id, filename, original_name, mime_type, size, created_at)
```

Content is stored as HTML (TipTap's output format). This is a reasonable tradeoff — it preserves all formatting, is human-readable, and round-trips cleanly with ProseMirror. A production system might use ProseMirror JSON or a CRDT-native format.

## Security Considerations (in scope for this demo)

- The `x-user-id` header is validated against the DB on every request — it's not trusted blindly
- Document access is checked on every read/write — unauthorized users get 403, not leaked data
- File uploads are validated by extension and MIME type before storage
- SQL uses parameterized queries throughout (better-sqlite3's `.prepare().run()`)
- CORS is restricted to the configured client origin

## Testing

7 integration tests in `__tests__/api.test.ts` cover:
- Login success and failure
- Auth requirement on protected routes
- Document creation
- Document listing (owned vs shared)
- Sharing flow
- Permission enforcement (non-owner cannot share)

Each test builds its own in-memory SQLite database so tests are fully isolated and fast.
