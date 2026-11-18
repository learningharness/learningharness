import {learnerDirectory} from '../../../packages/learning/src/user-memory.js';
import {companionDirectory} from '../../../packages/hosts/src/user-data.js';
import { markPanelVisibility } from './attention.js';
import { redactText } from '../../../packages/learning/src/redaction.js';
import { pendingNudge } from './nudge.js';
import { learnerStore } from '../../../packages/learning/src/learner-store.js';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, unlink, rename } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createCodexHost } from './host.js';
import { createClaudeHost } from '../../claude/src/host.js';
import { localStorage } from './storage.js';
import { privateOrigin, acceptsHost, acceptsOrigin } from './access.js';
import { LearningEngine } from '../../../packages/runtime/src/learning-engine.js';
import { createLocalDiagnostics } from '../../../packages/runtime/src/node-diagnostics.js';
import { loadNodeAnalytics } from '../../../packages/analytics/src/node-config.js';
let project = process.argv[2] ? resolve(process.argv[2]) : null;
const remoteOrigin = privateOrigin(process.env.DONTDUMB_PUBLIC_ORIGIN);
const port = Number(process.env.DONTDUMB_PORT ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid companion port');
const hostID=(process.env.LEARNING_HARNESS_HOST??process.env.DONTDUMB_HOST)==='claude'?'claude':'codex';
const directory = await companionDirectory({host:hostID});
const controlFile = join(directory, 'companion.json');
const workerDirectory = join(directory, 'worker'); await mkdir(workerDirectory, { recursive: true, mode: 0o700 });
const storage = await localStorage(directory); let host;
let server; let timer; let engine; let loaded = false; let analytics; let diagnostics;
let shuttingDown;
function shutdown() { return shuttingDown ??= close(); }
async function close() { clearInterval(timer); server?.close(); if (loaded) await engine.command({ action: 'stop' }).catch(() => {}); await host?.close(); analytics?.close(); await diagnostics?.flush(); try { const saved = JSON.parse(await readFile(controlFile, 'utf8')); if (saved.pid === process.pid) await unlink(controlFile); } catch {} await storage.close(); }
try {
  diagnostics = createLocalDiagnostics({ directory });
  host=await (hostID==='claude'?createClaudeHost:createCodexHost)({directory:workerDirectory,stateDirectory:directory,diagnostics});
  const account={account:host.account},catalog=host.catalog,preferred=catalog.find(m=>m.isDefault)??catalog[0];
  if(!preferred)throw new Error('No host model is available');
  const gateway=host.gateway;
  analytics = await loadNodeAnalytics({ adapter: hostID, surface: 'companion' });
  let revision = 0; let observationError = ''; let attached = null; let visibleAt=0; let openRequest=0; let nudgeWrites=Promise.resolve();
  const updateNudge=()=>{const notice=pendingNudge(engine.snapshot(attached?.id),{visible:Date.now()-visibleAt<6000,host:hostID});nudgeWrites=nudgeWrites.catch(()=>{}).then(async()=>{await writeFile(join(directory,'nudge.tmp'),JSON.stringify(notice),{mode:0o600});await rename(join(directory,'nudge.tmp'),join(directory,'nudge.json'));});return nudgeWrites;};
  const kinds = ['task.submitted', 'assistant.ended', 'tool.succeeded', 'tool.failed', 'file.changed'];
  engine = new LearningEngine({ learnerStore: learnerStore((process.env.LEARNING_HARNESS_STATE_DIR||process.env.DONTDUMB_STATE_DIR)&&!process.env.LEARNING_HARNESS_LEARNER_DIR&&!process.env.DONTDUMB_LEARNER_DIR ? join(directory,'learner') : await learnerDirectory()), storage, gateway, analytics, diagnostics, debounceMs: 600, maxAutomaticChecksPerTask: 2, proactiveFollowup:true, automaticMinIntervalMs:120000, maxAutomaticChecksPerWindow:3, automaticWindowMs:600000, maxGoalRequests: 2, maxLearningRequests: 3,
    defaultLearningModel: { providerID: hostID, modelID: preferred.model },
    capabilities: { host: hostID, sessionIdentity: 'stable', observation: { kinds, publicReasoning: 'none', replay: hostID==='codex' }, model: { independent: true, credentialReuse: hostID==='claude'?'claude-subscription-login':'codex-chatgpt-login', cancellation: 'best-effort', usage: 'measured-or-estimated' }, surface: { embedded: false, experiments: true, mindMaps: true, sourceNavigation: false }, persistence: { scope: 'local-single-writer', atomicity: 'rename', crossProcessWriter: false } }, emit: async () => { revision++; if(engine)await updateNudge().catch(()=>{}); } });
  await engine.load(); loaded = true;
  const observer = host.createObserver({ onEvent: event => engine.onWorkEvent(event), getSeen: id => engine.session(id).codexSeen, getTaskId: id => engine.session(id).workSelection?.task?.id, onCheckpoint: async (id, seen) => { engine.session(id).codexSeen = seen; await engine.persist(); } });
  const threads = async (scope=project) => host.listThreads(scope);
  timer = setInterval(() => { if (engine.state.enabled && attached) void observer.poll().then(() => { observationError = ''; }).catch(() => { observationError = 'Could not read current work. Learning will retry; coding continues.'; engine.record('observer_failed', attached.id, { error: 'unknown' }); }); }, 1500);
  const token = randomBytes(24).toString('hex'); const staticRoot = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
  server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
      if (!acceptsHost(req.headers.host, origin, remoteOrigin)) { res.writeHead(403); res.end(); return; }
      const url = new URL(req.url, origin);
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        const path = resolve(staticRoot, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!path.startsWith(staticRoot + '/')) throw new Error('Invalid asset path');
        const content = await readFile(path); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] ?? 'application/octet-stream'); res.end(content); return;
      }
      const auth = req.headers.authorization ?? ''; const expected = `Bearer ${token}`;
      if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected)) || !acceptsOrigin(req.headers.origin, origin, remoteOrigin)) { res.writeHead(403); res.end(); return; }
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > (url.pathname === '/api/command' ? 5100000 : 16000)) throw new Error('Request too large'); }
      const input = JSON.parse(raw || '{}'); let output;
      if (url.pathname === '/api/health') output = { product: 'learning-harness', version: hostID==='claude'?'0.1.0-beta.5':'0.1.0-beta.16', project };
      else if (url.pathname === '/api/shutdown') { output = { stopped: true }; setTimeout(() => void shutdown().finally(() => process.exit()), 100); }
      else if (url.pathname === '/api/project') {
        if (!(await threads(null)).some(thread => thread.cwd === input.project)) throw new Error('Choose an available project');
        await engine.command({ action: 'disable' }); observer.attach(null); attached = null; project = input.project; output = { project };
      }
      else if (url.pathname === '/api/bootstrap') output = { hostID, hostLabel:host.label, auth:host.auth?.(), openRequest, project, projects: [...new Set((await threads(null)).map(t => t.cwd))].filter(Boolean), mobileURL: remoteOrigin ? `${remoteOrigin}/#${token}` : null, account: { type: account.account.type, planType: account.account.planType }, models: catalog.map(m => m.model), threads: project ? await threads() : [], attached };
      else if (url.pathname === '/api/auth/connect' && host.connect) output=await host.connect();
      else if (url.pathname === '/api/auth/status' && host.refreshAuth) output=await host.refreshAuth();
      else if (url.pathname === '/api/attach') {
        const candidate = (await threads()).find(t => t.id === input.threadId && t.cwd === project);
        if (!candidate) throw new Error('Choose an available chat in this project');
        if(host.refreshAuth && !(await host.refreshAuth(candidate.id)).connected)throw new Error('Open LearningHarness in this Claude Code chat to connect learning.');
        await engine.command({ action: 'disable' }); observer.attach(candidate.id); attached = candidate;
        await engine.command({ action: 'enable' }); await engine.openSession(candidate.id,{title:candidate.name,project:candidate.cwd}); void observer.poll().catch(() => { observationError = 'Could not read current work'; }); output = { attached };
      } else if (url.pathname === '/api/detach') { await engine.command({ action: 'disable' }); observer.attach(null); attached = null; output = {};
      } else if (url.pathname === '/api/observe') {
        if(hostID!=='claude'||!attached||input.sessionId!==attached.id||!engine.state.enabled||engine.state.globallyStopped)output={accepted:false};
        else { const events=host.normalize(input);engine.record('observer_hook_received',attached.id,{eventCount:events.length});for(const event of events)await engine.onWorkEvent(event);output={accepted:true}; }
      } else if (url.pathname === '/api/open') {
        if(attached) await engine.command({action:'enable',sessionID:attached.id});
        openRequest++; revision++; output={opened:true};
      } else if (url.pathname === '/api/status') {
        if(input.visible===true)visibleAt=Date.now();else if(input.visible===false)visibleAt=0;
        if(markPanelVisibility(engine,attached?.id,input))await engine.persist();
        await updateNudge().catch(()=>{});output={...engine.snapshot(attached?.id),revision,openRequest,attached,observationError};
      }
      else if (url.pathname === '/api/command') {
        if (input.sessionID && input.sessionID !== attached?.id) throw new Error('This chat is not attached');
        output = await engine.command(input);
      } else throw new Error('Unknown companion action');
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(output));
    } catch (error) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: String(error.message).slice(0, 600) })); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  const ready = { product: 'learning-harness', version: hostID==='claude'?'0.1.0-beta.5':'0.1.0-beta.16', pid: process.pid, url: `http://127.0.0.1:${server.address().port}/#${token}`, project };
  await writeFile(controlFile, JSON.stringify(ready), { mode: 0o600 });
  process.send?.({ type: 'ready', ...ready });
  console.log(`LearningHarness ${host.label} companion: ${ready.url}`);
  console.log(account.account.connected===false?'Open Learn to connect your existing Claude subscription. No inference before connection and attachment.':`${host.label} sign-in verified. Choose a chat to start. No inference before attachment.`);
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit())); process.once('SIGINT', () => void shutdown().finally(() => process.exit()));
} catch (error) { const message=redactText(String(error.message)).slice(0,600);console.error(message);process.send?.({type:'startup-error',message}); await shutdown(); process.exitCode = 1; }
