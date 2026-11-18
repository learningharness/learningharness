const bound = (value) => String(value ?? "").slice(0, 3200);
const sensitive = (value) => /(?:\.env(?:\b|[./])|credentials|secrets?[./]|private[_-]?key|auth\.json|sk-(?:proj-)?[a-z0-9]{12}|bearer\s+[a-z0-9._-]{16})/i.test(value);
// Codex's supported thread tools expose the submitted prompt in a public
// dispatch item, rather than a userMessage. No arbitrary tool output is a task.
export function publicTaskText(item) {
  if (item.type === 'userMessage') return (item.content ?? []).filter(c => c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n');
  if (item.type !== 'functionCallOutput' || item.namespace !== 'codex_app' || !['create_thread', 'send_message_to_thread'].includes(item.name) || typeof item.output !== 'string' || item.output.length > 100000) return null;
  const match = /^<codex_delegation>\s*<source_thread_id>[^<>]+<\/source_thread_id>\s*<input>([\s\S]*)<\/input>\s*<\/codex_delegation>\s*$/.exec(item.output);
  return match?.[1] ?? null;
}
function normalizePublicItem(threadId, turnId, item) {
  const event = (type, data) => [{ version: 1, id: `${item.id}:${type}`, sessionId: threadId, type, data }];
  const taskText = publicTaskText(item);
  if (taskText !== null) {
    const text = bound(taskText);
    return !text || sensitive(text) ? [] : event("task.submitted", { text });
  }
  if (item.type === "agentMessage") return sensitive(item.text ?? "") ? [] : event("assistant.ended", { text: bound(item.text) });
  if (item.type === "commandExecution" && ["completed", "failed", "declined"].includes(item.status)) {
    if (sensitive(item.command ?? "") || sensitive(item.aggregatedOutput ?? "")) return [];
    return event(item.exitCode || item.status === "failed" ? "tool.failed" : "tool.succeeded", { tool: "command", command: bound(item.command), output: bound(item.aggregatedOutput), exitCode: item.exitCode });
  }
  if (item.type === "fileChange" && item.status === "completed") return (item.changes ?? []).filter((c) => !sensitive(c.path ?? "") && !sensitive(c.diff ?? "")).slice(0, 6).map((c, i) => ({ version: 1, id: `${item.id}:file:${i}`, sessionId: threadId, type: "file.changed", data: { path: bound(c.path), content: bound(c.diff) } }));
  return [];
}
export {
  normalizePublicItem
};
