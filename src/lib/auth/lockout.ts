// Client-side lockout for repeated failed auth attempts.
// Note: not a substitute for server-side rate limiting, but blocks casual abuse.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 15 * 60 * 1000;  // count failures within last 15 min

type Record = { failures: number[]; lockedUntil: number | null };

function key(scope: string, id: string) {
  return `auth_lockout:${scope}:${id.toLowerCase().trim()}`;
}

function read(scope: string, id: string): Record {
  if (typeof window === "undefined") return { failures: [], lockedUntil: null };
  try {
    const raw = localStorage.getItem(key(scope, id));
    if (!raw) return { failures: [], lockedUntil: null };
    return JSON.parse(raw) as Record;
  } catch {
    return { failures: [], lockedUntil: null };
  }
}

function write(scope: string, id: string, rec: Record) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(scope, id), JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

export function checkLockout(scope: "login" | "signup", id: string): { locked: boolean; remainingMs: number } {
  if (!id) return { locked: false, remainingMs: 0 };
  const rec = read(scope, id);
  const now = Date.now();
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return { locked: true, remainingMs: rec.lockedUntil - now };
  }
  if (rec.lockedUntil && rec.lockedUntil <= now) {
    write(scope, id, { failures: [], lockedUntil: null });
  }
  return { locked: false, remainingMs: 0 };
}

export function recordFailure(scope: "login" | "signup", id: string): { locked: boolean; remainingMs: number; attemptsLeft: number } {
  if (!id) return { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS };
  const now = Date.now();
  const rec = read(scope, id);
  const failures = [...rec.failures.filter((t) => now - t < WINDOW_MS), now];
  if (failures.length >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS;
    write(scope, id, { failures, lockedUntil });
    return { locked: true, remainingMs: LOCKOUT_MS, attemptsLeft: 0 };
  }
  write(scope, id, { failures, lockedUntil: null });
  return { locked: false, remainingMs: 0, attemptsLeft: MAX_ATTEMPTS - failures.length };
}

export function clearFailures(scope: "login" | "signup", id: string) {
  if (!id || typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(scope, id));
  } catch {
    /* ignore */
  }
}

export function formatRemaining(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? "1 minute" : `${mins} minutes`;
}
