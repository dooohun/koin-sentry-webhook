const MAX_STRING_LENGTH = 1_000;
const MAX_OBJECT_DEPTH = 4;
const MAX_OBJECT_KEYS = 50;

const SENSITIVE_KEY_PATTERNS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'phone',
  'email',
];

const REDACTED = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function truncateString(
  value: string,
  max: number = MAX_STRING_LENGTH,
): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated]`;
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (depth >= MAX_OBJECT_DEPTH) {
    return '[truncated: max depth]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_OBJECT_KEYS)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_OBJECT_KEYS) break;
      count += 1;
      out[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(val, depth + 1);
    }
    return out;
  }

  return truncateString(String(value));
}

export function sanitizeRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (value === null || value === undefined || typeof value !== 'object') {
    return undefined;
  }
  const sanitized = sanitizeValue(value, 0);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : undefined;
}
