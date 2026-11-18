// Optional HTTPS reverse proxy; the companion itself always stays on loopback.
export function privateOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Mobile origin must be an HTTPS origin, without a path or credentials');
  return url.origin;
}
export function acceptsHost(host, local, remote) { return [local, remote].filter(Boolean).some(origin => new URL(origin).host === host); }
export function acceptsOrigin(origin, local, remote) { return !origin || origin === local || Boolean(remote && origin === remote); }
