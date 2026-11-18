const TYPES = new Set(['task.submitted', 'reasoning.ended', 'assistant.ended', 'tool.started', 'tool.input.ended', 'tool.succeeded', 'tool.failed', 'file.changed']);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
function bound(value, depth = 0) {
  if (depth > 4) return '[depth omitted]';
  if (typeof value === 'string') return value.length > 1000 ? value.slice(0, 1000) + '\n[truncated]' : value;
  if (Array.isArray(value)) return value.slice(0, 6).map(v => bound(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'native').slice(0, 12).map(([k, v]) => [k, bound(v, depth + 1)]));
  return value;
}
export function freezeWork(trace, maxBytes = 24000) {
  const selected = []; let omitted = 0;
  for (const item of trace.filter(e => TYPES.has(e.type)).slice(-18).reverse()) {
    const safe = bound(item);
    if (bytes([...selected, safe]) > maxBytes - 500) { omitted++; continue; }
    selected.unshift(safe);
  }
  if (omitted) selected.push({ id: 'snapshot_omissions', type: 'snapshot.omitted', data: { omittedEvents: omitted } });
  return selected;
}
