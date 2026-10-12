import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import './db'; // initialize DB + seed

import authRouter from './routes/auth';
import documentsRouter from './routes/documents';
import uploadRouter from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — restrict to known client origins
const allowedOrigins = (
  process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://localhost:3002'
).split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-user-id'],
}));

// Minimal security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '10mb' }));

// NOTE: /uploads is intentionally NOT served statically.
// Attachment files are stored server-side; only metadata is returned to clients.
// If download is needed later, add an authenticated /api/attachments/:id route.

app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/upload', uploadRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Generic error handler — never leak stack traces to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
