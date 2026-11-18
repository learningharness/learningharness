// Assistance is canonical context, not a label the grader can override.
export function recordAssistance(moment, kind, at, detail = '') {
  moment.assistance ??= [];
  moment.assistance.push({ id: globalThis.crypto.randomUUID(), kind, at, detail: String(detail).slice(0, 400) });
}
export function assistanceFor(moment, hint) {
  const events = [...(moment.assistance ?? [])];
  if (hint?.momentId === moment.id && !events.some(e => e.kind === 'hint')) events.push({ kind: 'hint', at: hint.createdAt });
  if (moment.choices?.length) events.push({ kind: 'choices' });
  if (['explain', 'demonstrate', 'mind_map'].includes(moment.kind) && !(moment.entryMode==='prediction'&&!moment.explanationRevealed)) events.push({ kind: 'exposure' });
  return events;
}
