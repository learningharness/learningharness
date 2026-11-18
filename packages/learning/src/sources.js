// Handles refer only to captured host evidence; there is no filesystem API here.
export function sourceExcerpts(events,maxSources=3) {
  const sources = [];
  for (const event of events ?? []) {
    if (!['tool.succeeded', 'tool.failed', 'tool.input.ended', 'file.changed'].includes(event.type)) continue;
    const data = event.data ?? {}; const called = events.find(e => e.type === 'tool.started' && e.data?.id === data.id); const input = data.input ?? called?.data?.input ?? {};
    const path = data.path ?? data.file ?? input.filePath ?? input.file_path ?? input.path ?? '';
    if (/(^|[/\\])(?:\.env(?:[.\/\\]|$)|\.aws(?:[/\\]|$)|\.ssh(?:[/\\]|$)|credentials(?:[.\/\\]|$)|secrets?(?:[.\/\\]|$))/i.test(path)) continue;
    const raw = data.output ?? data.content ?? data.diff ?? data.patch ?? data.result ?? input.newString ?? input.new_string ?? input.content;
    const text = Array.isArray(raw) ? raw.filter(c => c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n') : typeof raw === 'string' ? raw : typeof raw?.text === 'string' ? raw.text : null;
    if (!text?.trim()) continue;
    sources.push({ id: event.id, path: String(path).slice(0, 240), status: event.type === 'tool.input.ended' ? 'Proposed input · outcome unverified' : event.type === 'tool.failed' ? 'Failed tool output' : 'Captured host output · excerpt', text: text.slice(0, 4000), truncated: text.length > 4000||/\[(?:excerpt|truncated|omitted)\]/i.test(text), at: event.capturedAt ?? event.occurredAt ?? null });
    if (sources.length >= maxSources) break;
  }
  return sources;
}
