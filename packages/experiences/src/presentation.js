// Preserve the full content; choose a short default reading surface.
export function briefText(text, limit = 240) {
  const full = String(text ?? '').trim();
  if (full.length <= limit) return { lead: full, more: '' };
  const prefix = full.slice(0, limit);
  const sentence = Math.max(prefix.lastIndexOf('. '), prefix.lastIndexOf('? '), prefix.lastIndexOf('! '));
  const boundary = sentence >= limit / 3 ? sentence + 1 : Math.max(prefix.lastIndexOf(' '), 1);
  return { lead: full.slice(0, boundary), more: full.slice(boundary).trimStart() };
}

// Keep local interaction state alive when an otherwise identical artifact arrives
// in a new status snapshot while the main agent continues working.
export function reuseArtifactReferences(next, previous) {
  for (const owner of ['moment','askAnswer']) for (const key of ['experiment','mindMap']) {
    const value=next?.session?.[owner]?.[key], prior=previous?.session?.[owner]?.[key];
    if(value&&prior&&JSON.stringify(value)===JSON.stringify(prior))next.session[owner][key]=prior;
  }
  return next;
}
