import {captureShellFiles} from './shell-files.js';
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, rename, link, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { normalizeClaudeEvent } from "./observer.js";
const hash = (value) => createHash("sha256").update(value).digest("hex");
function publicHookEvent(input) {
  const sessionId = input.session_id;
  const event = { sessionId, id: input.tool_use_id ? `${input.tool_use_id}:${input.hook_event_name}` : randomUUID() };
  const tool = input.tool_input ?? {};
  if (input.hook_event_name === "UserPromptSubmit") return { ...event, kind: "task", text: String(input.prompt ?? "").slice(0, 3200) };
  if (input.hook_event_name === "Stop" && typeof input.last_assistant_message === "string") return { ...event, kind: "reply", text: input.last_assistant_message.slice(0, 3200) };
  if (!["PostToolUse", "PostToolUseFailure"].includes(input.hook_event_name)) return null;
  if (input.hook_event_name === "PostToolUse" && ["Edit", "Write"].includes(input.tool_name)) return { ...event, kind: "file", path: String(tool.file_path ?? "").slice(0, 1e3), content: String(tool.new_string ?? tool.content ?? "").slice(0, 3200) };
  if (input.hook_event_name === "PostToolUse" && input.tool_name === "AskUserQuestion") {
    const answers=input.tool_response?.answers;
    const text=answers&&typeof answers==='object'&&!Array.isArray(answers)?Object.entries(answers).filter(([question,answer])=>typeof answer==='string').slice(0,4).map(([question,answer])=>`${question}: ${answer}`).join('\n').slice(0,3200):'';
    return text?{...event,kind:'task',text}:null;
  }
  if (input.hook_event_name === "PostToolUse" && input.tool_name === "Read") return { ...event, kind: "read", path: String(tool.file_path ?? "").slice(0, 1e3), content:typeof input.tool_response?.file?.content==='string'?input.tool_response.file.content.slice(0,3200):typeof input.tool_response?.content==='string'?input.tool_response.content.slice(0,3200):'' };
  if (input.tool_name === "Bash") return { ...event, kind: "command", command: String(tool.command ?? "").slice(0, 3200), output: String(input.tool_response?.stdout ?? input.tool_response?.stderr ?? "").slice(0, 3200), failed: input.hook_event_name === "PostToolUseFailure" };
  return null;
}
async function enqueueClaudeHook(directory, input) {
  const changed = await captureShellFiles(directory,input);
  const event = publicHookEvent(input) ?? (changed.length ? {sessionId:input.session_id,id:`${input.tool_use_id}:${input.hook_event_name}`} : null);
  if (!event) return;
  const events = [...normalizeClaudeEvent(event),...changed.filter(item=>normalizeClaudeEvent({sessionId:item.sessionId,id:item.id,kind:"file",path:item.data.path,content:item.data.content}).length)];
  if (!events.length) return;
  const folder = join(directory, "events", hash(event.sessionId));
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const files = (await readdir(folder)).filter((f) => /^[0-9a-f]{64}\.json$/.test(f));
  if (files.length >= 100) {
    const entries = await Promise.all(files.map(async (name) => ({ name, at: await stat(join(folder, name)).then((s) => s.mtimeMs).catch(() => 0) })));
    for (const old of entries.sort((a, b) => a.at - b.at).slice(0, files.length - 99)) await unlink(join(folder, old.name)).catch(() => {
    });
  }
  const file = join(folder, hash(event.id) + ".json"), tmp = file + "." + randomUUID() + ".tmp";
  await writeFile(tmp, JSON.stringify({ id: event.id, sessionId: event.sessionId, at: Date.now(), events }), { mode: 0o600 });
  try { await link(tmp,file); } catch(error) { if(error.code!=="EEXIST")throw error; } finally { await unlink(tmp); }
}
async function captureClaudeHook(directory, input) {
  if (typeof input.cwd === "string" && input.cwd.length < 4e3) {
    const folder = join(directory, "sessions");
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const file = join(folder, hash(input.session_id) + ".json"), tmp = file + "." + randomUUID() + ".tmp";
    await writeFile(tmp, JSON.stringify({ id: input.session_id, cwd: input.cwd, at: Date.now() }), { mode: 0o600 });
    try { await link(tmp,file); } catch(error) { if(error.code!=="EEXIST")throw error; } finally { await unlink(tmp); }
  }
  await enqueueClaudeHook(directory, input);
}
export {
  captureClaudeHook,
  enqueueClaudeHook,
  publicHookEvent
};
