// Local, provider-independent evidence selection. Scores prioritize observations;
// they are heuristics, not claims that we understand every work decision.
import { redactValue } from './redaction.js';
import {sourceExcerpts} from './sources.js';
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const text = (value, limit) => {
  const raw = String(value ?? '');
  if (bytes(raw) <= limit) return raw;
  // Keep both the start and diagnostic/diff tail; mark omissions explicitly.
  const diagnostic = raw.split('\n').filter(line => /error|fail|expected|actual|assert|^[+-]/i.test(line)).slice(-8).join('\n');
  let result = `${raw.slice(0, Math.floor(limit / 2))}\n[excerpt]\n${(diagnostic || raw).slice(-Math.floor(limit / 3))}`;
  while (bytes(result) > limit) result = result.slice(0, -1);
  return result;
};
function bounded(value, limit = 1200, depth = 0) {
  if (typeof value === 'string') return text(value, limit);
  if (depth > 3) return '[omitted]';
  if (Array.isArray(value)) return value.slice(0, 4).map(item => bounded(item, Math.floor(limit / 4), depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['native', 'sessionID', 'model', 'tokens'].includes(key)).slice(0, 10).map(([key, item]) => [key, bounded(item, Math.floor(limit / 2), depth + 1)]));
  return value;
}
// A bounded non-security fingerprint avoids retaining duplicate payload copies.
function fingerprint(value) {
  let a = 2166136261; let b = 5381;
  for (const char of JSON.stringify(value)) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ char.charCodeAt(0); }
  return `${a >>> 0}:${b >>> 0}`;
}
export const pathOf = data => String(data.path ?? data.file ?? data.input?.filePath ?? data.input?.file_path ?? data.input?.path ?? '').slice(0, 160);
const sensitive = path => /(^|[/\\])(?:\.env(?:[.\/\\]|$)|\.aws(?:[/\\]|$)|\.ssh(?:[/\\]|$)|credentials(?:[.\/\\]|$)|secrets?(?:[.\/\\]|$))/i.test(path);
export function createWorkSelection() {
  return { version: 1, sequence: 0, cursor: 0, task: null, reasoningSampled: false, entries: [], seen: [], tools: [], stats: { observedEvents: 0, observedBytes: 0, selectedEvents: 0, updates: 0, sampledBytes: 0 } };
}
export function observeWork(state, event) {
  state.stats.observedEvents++; state.stats.observedBytes += bytes(event.data ?? {});
  const { type } = event;
  if (!['task.submitted', 'reasoning.ended', 'assistant.ended', 'tool.started', 'tool.input.ended', 'tool.succeeded', 'tool.failed', 'file.changed'].includes(type)) return false;
  const data = redactValue(event.data ?? {});
  if (type === 'tool.started' || type === 'tool.input.ended') {
    let input = data.input;
    if (!input && typeof data.text === 'string') { try { input = JSON.parse(data.text); } catch { /* Not structured input. */ } }
    const hidden = sensitive(pathOf({ ...data, input }));
    state.tools = [...state.tools.filter(t => t.id !== data.id), hidden ? { id: data.id, sensitive: true } : { id: data.id, input: bounded(input ?? data, 600), name: data.name ?? data.tool }].slice(-12);
    if (hidden || type === 'tool.started') return false;
  }
  const called = state.tools.find(t => t.id && t.id === data.id);
  if (called?.sensitive) return false;
  if (called && ['tool.succeeded', 'tool.failed'].includes(type)) { data.input ??= called.input; data.name ??= called.name; }
  if (sensitive(pathOf(data))) return false;
  if (type === 'reasoning.ended' && state.reasoningSampled) return false;
  if (type === 'assistant.ended' && /^(?:still\s+)?(?:working|thinking|reading|checking|preparing|done)[.!…\s]*$/i.test(data.text ?? '')) return false;
  const limit = type === 'reasoning.ended' ? 300 : type === 'task.submitted' ? 800 : 1800;
  const relevant = Object.fromEntries(['text', 'path', 'file', 'diff', 'patch', 'output', 'content', 'result', 'error', 'input', 'name', 'tool', 'status', 'exitCode', 'command'].filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  if (!Object.keys(relevant).length) return false;
  let projected = bounded(relevant, limit);
  for (let bound = limit / 2; bytes(projected) > 2000 && bound >= 16; bound /= 2) projected = bounded(relevant, Math.floor(bound));
  const key = fingerprint({ type, ...(type === 'task.submitted' ? { id: event.id } : {}), data: { ...projected, id: undefined } });
  if (state.seen.includes(key)) return false;
  state.seen = [...state.seen, key].slice(-128);
  if (type === 'task.submitted') {
    // Historical grounding survives short steering; it is never fresh evidence.
    const candidates=[...state.entries.filter(e=>e.priority>=60).map(e=>e.source),...(state.task?[state.task]:[]),...(state.recentContext??[])];
    const context=[];const ids=new Set();
    for(const item of candidates){if(ids.has(item.id))continue;ids.add(item.id);const sample={id:item.id,type:item.type,data:bounded(item.data,360)};if(context.length<5&&bytes([...context,sample])<=1800)context.push(sample);}
    state.recentContext=context;
    state.entries = []; state.reasoningSampled = false; state.tools = []; state.seen = [key];
    state.task = { id: event.id, type, data: { text: text(data.text ?? '', 800) } };
    state.sequence++; state.taskSequence = state.sequence; state.stats.selectedEvents++; return true;
  }
  if (type === 'reasoning.ended') state.reasoningSampled = true;
  const name = [data.name,data.tool,data.command,data.input?.command].filter(Boolean).join(' ');
  const command=String(data.command??data.input?.command??'');
  const milestone=/^(?:test|build|lint|check|typecheck|edit|write|patch|apply_patch)$/i.test(data.name??data.tool??'')||/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|lint|typecheck|check)\b|\b(?:node\s+--test|pytest|vitest|cargo\s+test|go\s+test|tsc|apply_patch|writeFile(?:Sync)?|write_text)\b/.test(command);
  const discovery=!milestone&&/\b(?:rg|grep|ls|pwd|find|cat|head|tail)\b/.test(name)&&!/error|exception|traceback|assertion/i.test(String(data.output??data.error??''));
  const readEvidence=Boolean(pathOf(data))||/^(?:read|Read)$/.test(data.name??data.tool??'');
  if((type==='tool.failed'&&discovery)||(type==='tool.succeeded'&&command&&!milestone&&!readEvidence))return false;
  if(type==='tool.succeeded'&&!milestone){projected=bounded(relevant,800);const path=pathOf(data);if(path)state.entries=state.entries.filter(e=>!(e.priority===40&&pathOf(e.source.data)===path));}
  const priority = type === 'tool.failed' ? 100 : type === 'file.changed' ? 90
    : type === 'tool.succeeded' ? (milestone?85:/^(?:read|Read)$/.test(data.name??data.tool??'')?40:65) : type === 'assistant.ended' ? 60 : type === 'reasoning.ended' ? 10 : 20;
  const source = { id: event.id, type, ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),...(event.capturedAt?{capturedAt:event.capturedAt}:{}), data: projected };
  // Exact duplicate outputs under different tool invocations should not call again.
  const entry = { source, priority, sequence: ++state.sequence };
  state.entries.push(entry);
  // Once files are captured, public commentary may fill spare space but
  // must not evict code/tool evidence and invalidate an unchanged lesson.
  const fileGrounded=sourceExcerpts(state.entries.map(e=>e.source),state.entries.length).some(source=>source.path&&source.status==='Captured host output · excerpt');
  const rank=e=>fileGrounded&&e.source.type==='assistant.ended'?-1:e.priority;
  state.entries.sort((a,b)=>rank(b)-rank(a)||b.sequence-a.sequence);
  const kept = []; const categories = {}; let used = state.task ? bytes(state.task) : 0;
  for (const item of state.entries) {
    const category = item.source.type; const categoryLimit = category === 'tool.succeeded' ? 6 : 4;
    if (kept.length >= 12 || (categories[category] ?? 0) >= categoryLimit || used + bytes(item.source) >= 9700) continue;
    kept.push(item); categories[category] = (categories[category] ?? 0) + 1; used += bytes(item.source);
  }
  state.entries = kept;
  const retained = kept.includes(entry);
  if (retained) state.stats.selectedEvents++;
  return retained;
}
export function selectedWork(state, { since = 0, maxBytes = 10000, includeTask = true } = {}) {
  const result = [];
  if (includeTask && state.task && (state.taskSequence ?? 0) > since && bytes([state.task]) <= maxBytes) result.push(state.task);
  for (const entry of state.entries) if (entry.sequence > since && bytes([...result, entry.source]) <= maxBytes) result.push(entry.source);
  return structuredClone(result);
}
export function hasWorkUpdate(state) {
  return (state.taskSequence ?? 0) > state.cursor || state.entries.some(entry => entry.sequence > state.cursor && (entry.priority >= 60 || state.cursor === 0));
}
export function consumeWork(state, through) { state.cursor = Math.max(state.cursor, through); }
export function workUpdate(state, { previousGoals = [], since = state.cursor } = {}) {
  const context = { previousWork: state.recentContext??[], task: state.task?.data.text ?? '', files: [...new Set(state.entries.map(e => pathOf(e.source.data)).filter(Boolean))].slice(0, 5).map(path => text(path, 120)), previousGoals: previousGoals.slice(0, 3).map(g => text(g.outcome, 80)), tentative: !state.entries.some(e => e.priority >= 60) };
  const packet = { context, changes: selectedWork(state, { since, includeTask: false, maxBytes: 2700 }) };
  while (bytes(packet) > 4500 && packet.changes.length) packet.changes.pop();
  return packet;
}
export function workBrief(work, maxBytes = 2200, sourceBytes = 360) {
  const brief = [];
  for (const event of work) {
    const sample = { id: event.id, type: event.type, data: bounded(event.data, event.type === 'task.submitted' ? 500 : sourceBytes) };
    if (bytes([...brief, sample]) <= maxBytes) brief.push(sample);
  }
  return brief;
}
