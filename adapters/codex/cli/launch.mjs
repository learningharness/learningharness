#!/usr/bin/env node
import {companionDirectory} from '../../../packages/hosts/src/user-data.js';
import { fork, spawn, spawnSync } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { openSync, closeSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const hostID=(process.env.LEARNING_HARNESS_HOST??process.env.DONTDUMB_HOST)==='claude'?'claude':'codex';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function parseArgs(args) {
  const options = { project: null, noOpen: false, doctor: false, stop: false, install: false, foreground: false, help: false, origin: null, port: 0 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--doctor') options.doctor = true;
    else if (arg === '--stop') options.stop = true;
    else if (arg === '--install-plugin') options.install = true;
    else if (arg === '--foreground') options.foreground = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--mobile-origin') { options.origin = args[++i]; if (!options.origin) throw new Error('Supply an HTTPS mobile origin'); const url = new URL(options.origin); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Supply only an HTTPS origin'); options.origin = url.origin; }
    else if (arg === '--port') { options.port = Number(args[++i]); if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Supply a port from 1 to 65535'); }
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (options.project) throw new Error('Supply just one project path');
    else options.project = resolve(arg);
  }
  return options;
}
export async function runningCompanion(directory) {
  try {
    const saved = JSON.parse(await readFile(join(directory, 'companion.json'), 'utf8')); const url = new URL(saved.url);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !/^#[0-9a-f]{48}$/.test(url.hash)) return null;
    const response = await fetch(url.origin + '/api/health', { method: 'POST', headers: { Authorization: 'Bearer ' + url.hash.slice(1), 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500) });
    return response.ok && ['learning-harness','dontdumb'].includes((await response.json()).product) ? saved : null;
  } catch { return null; }
}
export function openBrowser(url, { platform = process.platform, spawnProcess = spawn } = {}) {
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  return new Promise((resolveOpen, reject) => {
    const child = spawnProcess(command, [url], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Companion is running, but browser opening timed out. Use the printed private link.')); }, 5000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Companion is running, but the browser could not open. Use the printed private link.')); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolveOpen(); else reject(new Error('Companion is running, but the browser refused to open. Use the printed private link.')); });
  });
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log('LearningHarness beta\n\n  dontdumb [project path]       Open the local learning companion\n  dontdumb --doctor             Check Node, Codex and ChatGPT sign-in; no inference\n  dontdumb --install-plugin     Register this local plugin marketplace\n  dontdumb --stop               Stop this companion\n  --no-open                    Print the link without opening a browser\n  --mobile-origin https://...   Accept an existing private HTTPS reverse proxy\n  --port 15447                 Use a stable loopback port for that proxy'); return; }
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('LearningHarness needs Node.js 22 or newer');
  const { startCodex, findCodex } = await import(new URL('../lib/rpc.mjs', import.meta.url));
  if (options.install) { const result = spawnSync(findCodex(), ['plugin', 'marketplace', 'add', root], { stdio: 'inherit' }); if (result.error || result.status !== 0) throw new Error('Could not register the local plugin marketplace'); console.log('Restart ChatGPT/Codex desktop, open Plugins, choose LearningHarness Beta, then install LearningHarness.'); return; }
  if(options.doctor&&hostID==='claude'){const {ClaudeLearningGateway}=await import(new URL('../lib/claude-host.mjs',import.meta.url));const directory=await companionDirectory({host:'claude'});await mkdir(directory,{recursive:true,mode:0o700});const gateway=new ClaudeLearningGateway({directory});try{await gateway.authenticate();console.log('Ready: Claude subscription sign-in verified. No inference was run.');}finally{gateway.close();}return;}
  if (options.doctor) { const rpc = startCodex(); try { await rpc.initialize(); const account = await rpc.request('account/read', { refreshToken: false }); if (account.account?.type !== 'chatgpt') throw new Error('Sign in to Codex with ChatGPT first'); console.log(`Ready: Node ${process.versions.node}, Codex app-server, ChatGPT ${account.account.planType ?? ''}. No inference was run.`); } finally { rpc.close(); } return; }
  const directory = await companionDirectory({host:hostID});
  const existing = await runningCompanion(directory);
  if (options.stop) { if (!existing) { console.log('No reachable companion is running.'); return; } const url = new URL(existing.url); const response = await fetch(url.origin + '/api/shutdown', { method: 'POST', headers: { Authorization: 'Bearer ' + url.hash.slice(1), 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error('Companion refused shutdown'); console.log('Companion stopped; your coding chat is unchanged.'); return; }
  if (existing) { if (options.origin || options.port) throw new Error('A companion is already running. Stop it with --stop before changing its phone configuration.'); const url=new URL(existing.url); const response=await fetch(url.origin+'/api/open',{method:'POST',headers:{Authorization:'Bearer '+url.hash.slice(1),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)}); if(!response.ok)throw new Error('Could not reopen Learn. Your coding session continues.'); console.log(existing.url); if (!options.noOpen) await openBrowser(existing.url); return; }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let publicAnalytics = {};
  try { const config = JSON.parse(await readFile(join(root, 'lib/analytics-public.json'), 'utf8')); if (/^phc_[a-zA-Z0-9_-]+$/.test(config.token) && ['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(config.host)) publicAnalytics = { DONTDUMB_POSTHOG_TOKEN: config.token, DONTDUMB_POSTHOG_HOST: config.host }; } catch {}
  const log = openSync(join(directory, 'companion.log'), 'a', 0o600);
  const child = fork(join(root, 'lib', 'server.mjs'), options.project ? [options.project] : [], { detached: !options.foreground, stdio: ['ignore', log, log, 'ipc'], env: { ...publicAnalytics, ...process.env, ...(options.origin ? { DONTDUMB_PUBLIC_ORIGIN: options.origin } : {}), ...(options.port ? { DONTDUMB_PORT: String(options.port) } : {}) } }); closeSync(log);
  const ready = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Companion startup timed out; check companion.log in its local data directory')); }, 20000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Could not start the companion')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Companion could not start. Check companion.log in its local data directory for the actual cause.')); });
    child.on('message', message => { if(message?.type==='startup-error'){clearTimeout(timer);reject(new Error(message.message||'Companion startup failed'));return;} if (message?.type === 'ready') { clearTimeout(timer); resolveReady(message); } });
  });
  console.log(ready.url); child.disconnect();
  if (!options.foreground) child.unref();
  if (!options.noOpen) await openBrowser(ready.url);
  if (options.foreground) await new Promise(resolveExit => child.once('exit', resolveExit));
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
