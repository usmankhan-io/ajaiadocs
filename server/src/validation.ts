export const LIMITS = {
  TITLE_MAX: 500,
  CONTENT_MAX: 2_000_000, // 2MB of HTML
  EMAIL_MAX: 254,
};

const ALLOWED_PERMISSIONS = new Set(['edit', 'view']);

export function isValidPermission(p: unknown): p is 'edit' | 'view' {
  return typeof p === 'string' && ALLOWED_PERMISSIONS.has(p);
}

export function isValidEmail(e: unknown): e is string {
  return (
    typeof e === 'string' &&
    e.length > 0 &&
    e.length <= LIMITS.EMAIL_MAX &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );
}

export function sanitizeTitle(t: unknown): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  if (trimmed.length === 0 || trimmed.length > LIMITS.TITLE_MAX) return null;
  return trimmed;
}

export function isValidContent(c: unknown): c is string {
  return typeof c === 'string' && c.length <= LIMITS.CONTENT_MAX;
}

/** Escape HTML special characters to prevent XSS when inserting plain text into HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
