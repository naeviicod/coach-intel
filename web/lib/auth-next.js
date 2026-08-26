// Discord OAuth lands on /auth/callback. The invite path has to survive that
// hop as a real `/join/…` URL — an encoded cookie value is not a path, and
// sending people to /dashboard skips redeem.

export function safeAuthNext(value, fallback = '/dashboard') {
  let next = String(value || '');
  try {
    next = decodeURIComponent(next);
  } catch {
    /* keep the raw string */
  }
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
