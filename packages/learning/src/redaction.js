export function redactText(value) {
  return String(value).replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[redacted private key]')
    .replace(/\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{16,}/g, '[redacted credential]')
    .replace(/\bAKIA[A-Z0-9]{16}\b/g, '[redacted access key]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/((?:password|api[_-]?key|secret|access[_-]?token)\s*[=:]\s*["']?)[^\s"',;]+/gi, '$1[redacted]');
}
export function redactValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key !== 'tokens' && /password|bearer|token|secret|authorization|cookie|api[-_]?key/i.test(key) ? '[redacted]' : redactValue(item)]));
  return value;
}
