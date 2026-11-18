import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';
// Own stdio process only. Observed work threads are never resumed or prompted.
export class CodexRpc extends EventEmitter {
  #learningTools = new Map();
  constructor(child) {
    super(); this.child = child; this.pending = new Map(); this.sequence = 0; this.buffer = ''; this.closed = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (this.buffer.length > 16_000_000) return this.fail(new Error('Codex protocol response exceeds bounds'));
      let newline;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1);
        if (!line.trim()) continue;
        let message; try { message = JSON.parse(line); } catch { this.fail(new Error('Invalid Codex protocol response')); return; }
        if (message.method && message.id !== undefined) {
          void this.answerServerRequest(message);
        } else if (message.id !== undefined) {
          const pending = this.pending.get(message.id); if (!pending) continue;
          this.pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(String(message.error.message ?? 'Codex request failed').slice(0, 600)));
          else pending.resolve(message.result);
        } else if (message.method) this.emit('notification', message);
      }
    });
    // Host stderr can include private configuration; never relay or persist it.
    child.stderr?.resume(); child.on('error', () => this.fail(new Error('Could not start Codex app-server')));
    child.on('exit', () => this.fail(new Error('Codex app-server disconnected')));
  }
  // Explicit opt-in only for newly created learning-owned threads. The production
  // JSON gateway never binds this capability. Permission/auth actions stay denied.
  bindLearningTools(threadId, tools, handler) {
    if (!threadId || this.#learningTools.has(threadId) || !tools.length || typeof handler !== 'function') throw Error('Invalid learning tool binding');
    const binding = { tools: new Set(tools), handler };
    this.#learningTools.set(threadId, binding);
    return () => { if (this.#learningTools.get(threadId) === binding) this.#learningTools.delete(threadId); };
  }
  async answerServerRequest(message) {
    const p = message.params, binding = this.#learningTools.get(p?.threadId);
    const deny = () => ({ id: message.id, error: { code: -32601, message: 'LearningHarness does not authorize host actions' } });
    let response = deny();
    if (message.method === 'item/tool/call' && binding?.tools.has(p.tool) && p.namespace == null && typeof p.turnId === 'string' && typeof p.callId === 'string') {
      try {
        const result = await binding.handler(p);
        if (this.#learningTools.get(p.threadId) === binding) response = { id: message.id, result };
      } catch { response = { id: message.id, error: { code: -32603, message: 'Learning tool execution failed' } }; }
    }
    if (!this.closed) { try { this.send(response); } catch { this.fail(new Error('Codex tool response failed')); } }
  }
  send(message) { if (this.closed) throw new Error('Codex app-server is closed'); this.child.stdin.write(JSON.stringify(message) + '\n'); }
  request(method, params = {}, timeoutMs = 15000) {
    if (this.closed) return Promise.reject(new Error('Codex app-server is closed'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex ${method} timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  fail(error) { this.closed = true; this.#learningTools.clear(); for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); } this.pending.clear(); this.emit('disconnected'); }
  async initialize() { await this.request('initialize', { clientInfo: { name: 'dontdumb', title: 'LearningHarness learning companion', version: '0.1.0' }, capabilities: { experimentalApi: true } }); this.send({ method: 'initialized', params: {} }); }
  close() { this.child.kill('SIGTERM'); this.fail(new Error('Codex learning connection stopped')); }
}
export function findCodex(env = process.env, platform = process.platform) {
  if (env.DONTDUMB_CODEX_BIN) return env.DONTDUMB_CODEX_BIN;
  const name = platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = (env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => join(dir, name));
  if (platform === 'darwin') candidates.push('/Applications/Codex.app/Contents/Resources/codex', '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
  const found = candidates.find(path => existsSync(path));
  if (!found) throw new Error('Codex was not found. Install/sign into Codex, or set DONTDUMB_CODEX_BIN to its executable.');
  return found;
}
export function startCodex({ executable = findCodex() } = {}) {
  const disabled = ['shell_tool', 'apps', 'plugins', 'multi_agent', 'hooks', 'memories', 'browser_use', 'in_app_browser', 'computer_use', 'image_generation', 'workspace_dependencies', 'view_image', 'remote_plugin', 'request_permissions_tool'];
  const args = ['app-server', '--listen', 'stdio://', '-c', 'web_search="disabled"', '-c', 'skills.bundled.enabled=false', '-c', 'skills.max_context_tokens=1', '-c', 'project_doc_max_bytes=0', '-c', 'features.daemon_auto_start=false', ...disabled.flatMap(key => ['-c', `features.${key}=false`])];
  return new CodexRpc(spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] }));
}
