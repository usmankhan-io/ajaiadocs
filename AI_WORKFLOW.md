# AI Workflow Note

## Tools Used

- **Claude Sonnet** (via Claude Code desktop app) — primary coding assistant throughout the build

## Where AI Materially Sped Up My Work

**Scaffolding time cut from ~60 min to ~10 min.**  
The boilerplate for a TypeScript Express backend with SQLite, typed middleware, and a CORS config is repetitive to write. AI generated the entire server scaffold (db.ts, middleware, route structure) in one pass. I read and reviewed each file before moving on.

**TipTap toolbar and CSS.**  
Getting TipTap's `isActive()` checks right for the heading dropdown and toolbar buttons is fiddly. AI produced a clean working version that I validated by testing in the browser.

**Test setup.**  
The `__tests__/api.test.ts` file — using an in-memory SQLite instance per test suite — is the kind of test wiring that's tedious but important. AI produced the correct pattern (build a fresh DB + minimal Express app per test) quickly.

## What I Changed or Rejected

**Changed: File filter logic in multer.**  
AI's initial `fileFilter` only checked `file.mimetype`, which is unreliable (browsers often send `application/octet-stream` for `.md` files). I changed it to check both the extension and MIME type to handle this edge case correctly.

**Changed: Auto-save trigger.**  
AI's first draft saved on every `onUpdate` event with a 3-second debounce. I shortened it to 1.5s and added a `saveStatus` state to show the user "Saved / Saving / Unsaved" — a small but product-meaningful change.

**Rejected: JWT auth.**  
AI suggested adding JWT tokens. I rejected this because: (1) the assignment scope didn't require it, (2) it adds 30+ min of work for a demo feature, and (3) the `x-user-id` header pattern, while not production-safe, is perfectly honest and clearly labeled in the docs. I kept the mocked auth.

**Rejected: Seeding documents in db.ts.**  
AI suggested pre-seeding sample documents. I rejected this — empty state is honest and lets reviewers test the full creation flow themselves.

## How I Verified Correctness, UX Quality, and Reliability

**API verification:**
- Ran `npx tsc --noEmit` after every file to catch type errors early
- Hit each endpoint with `Invoke-RestMethod` to verify responses before building the frontend
- Ran all 7 tests (`npx jest --forceExit`) and confirmed they passed

**UX verification:**
- Opened the app in browser and walked through the complete flow: login → create doc → type → share with Bob → sign in as Bob → verify shared doc appears
- Verified the view-only banner appears correctly for view-permission shares
- Tested the file import with a `.txt` file and confirmed content appeared in the editor
- Tested the error state for unsupported file types

**Reliability:**
- Restarted the server and confirmed documents persisted
- Opened the editor in two tabs to verify the title save and content save didn't conflict
- Checked the network tab to confirm auto-save requests fired correctly
