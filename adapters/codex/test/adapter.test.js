import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexRpc } from '../src/rpc.js';
import { normalizeItem, CodexObserver } from '../src/observer.js';
import { CodexLearningGateway } from '../src/model-gateway.js';
import { localStorage } from '../src/storage.js';
test('Codex RPC correlates split frames, rejects host actions and fails outstanding calls on disconnect', async () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); const sent = []; child.stdin = { write: text => sent.push(JSON.parse(text)) }; child.kill = () => {};
  const rpc = new CodexRpc(child); const pending = rpc.request('fixture', {});
  child.stdout.write('{"id":1,"result":'); child.stdout.write('{"ok":true}}\n'); assert.deepEqual(await pending, { ok: true });
  child.stdout.write('{"id":99,"method":"item/commandExecution/requestApproval","params":{}}\n');
  assert.equal(sent.at(-1).error.code, -32601);
  const remaining = rpc.request('fixture', {}); child.emit('exit'); await assert.rejects(remaining, /disconnected/);
});
test('Codex normalizer excludes reasoning and sensitive outputs and bounds visible evidence', () => {
  assert.deepEqual(normalizeItem('work', 'turn', { id: 'x', type: 'reasoning', text: 'PRIVATE_REASONING' }), []);
  assert.deepEqual(normalizeItem('work', 'turn', { id: 'x', type: 'commandExecution', status: 'completed', command: 'cat .env', aggregatedOutput: 'PRIVATE' }), []);
  const events = normalizeItem('work', 'turn', { id: 'x', type: 'commandExecution', status: 'completed', command: 'npm test', aggregatedOutput: 'failed'.repeat(2000), exitCode: 1 });
  assert.equal(events[0].type, 'tool.failed'); assert.ok(events[0].data.output.length <= 3200);
});
test('observer reads bounded history without resuming/prompts and deduplicates unchanged work', async () => {
  const calls = []; const captured = [];
  const rpc = { request: async (name, params) => { calls.push([name, params]); return name === 'thread/turns/list' ? { data: [{ id: 'turn' }] } : { data: [{ item: { id: 'user', type: 'userMessage', content: [{ type: 'text', text: 'Implement retries' }] } }] }; } };
  const observer = new CodexObserver({ rpc, onEvent: async event => captured.push(event) }); observer.attach('work'); await observer.poll(); await observer.poll();
  assert.equal(captured.length, 1); assert.ok(calls.every(([name]) => ['thread/turns/list', 'thread/items/list'].includes(name)));
  assert.ok(calls.every(([,params]) => params.threadId === 'work'));
});
test('gateway creates isolated learning threads, reports measured tokens and interrupts only owned work', async () => {
  const rpc = new EventEmitter(); const calls = [];
  rpc.request = async (method, params) => { calls.push([method, params]);
    if (method === 'config/read') return { config: { mcp_servers: { fixture: { url: 'PRIVATE_ENDPOINT', env: { TOKEN: 'PRIVATE_TOKEN' } } } } };
    if (method === 'thread/start') return { thread: { id: 'learning' } };
    if (method === 'turn/start') { queueMicrotask(() => {
      rpc.emit('notification', { method: 'item/completed', params: { threadId: 'learning', item: { type: 'agentMessage', text: '{"tool":"stay_silent","input":{"reason":"Trivial"},"reason":"Trivial"}' } } });
      rpc.emit('notification', { method: 'thread/tokenUsage/updated', params: { threadId: 'learning', tokenUsage: { last: { inputTokens: 5, outputTokens: 2 }, total: { inputTokens: 50, outputTokens: 20, cachedInputTokens: 10 } } } });
      rpc.emit('notification', { method: 'turn/completed', params: { threadId: 'learning', turn: { status: 'completed' } } });
    }); return { turn: { id: 'turn' } }; }
  };
  const gateway = new CodexLearningGateway({ rpc, directory: '/empty-worker', models: [{ model: 'fixture' }] });
  const responseSchema={type:'object',properties:{tool:{type:'string'}},required:['tool'],additionalProperties:false};
  const result = await gateway.generate({ parentSessionId: 'main-work', model: { providerID: 'codex', modelID: 'fixture' }, intent: 'goals', prompt: 'Synthetic', responseSchema, onPrepared: async () => {} });
  assert.equal(result.usage.input, 50); assert.equal(result.usage.estimated, undefined);
  assert.equal(result.usage.inputIncludesCache, true); assert.equal(result.usage.outputIncludesReasoning, true);
  const start = calls.find(([name]) => name === 'thread/start')[1]; assert.equal(start.ephemeral, true); assert.equal(start.sandbox, 'read-only'); assert.deepEqual(start.config.mcp_servers.fixture, { enabled: false }); assert.doesNotMatch(JSON.stringify(start.config), /PRIVATE/);
  assert.equal(calls.find(([name]) => name === 'turn/start')[1].threadId, 'learning');
  assert.deepEqual(calls.find(([name]) => name === 'turn/start')[1].outputSchema,responseSchema);
  assert.deepEqual(start.environments,[]);
  gateway.active.set('learning', { threadId: 'learning', turnId: 'own-turn', parentSessionId: 'main-work' });
  await gateway.cancel('other'); assert.equal(calls.filter(([name]) => name === 'turn/interrupt').length, 0);
  await gateway.cancel('main-work'); assert.equal(calls.at(-1)[1].threadId, 'learning');
});
test('local learning store writes atomically and refuses a second writer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dd-codex-store-'));
  try { const store = await localStorage(directory); await assert.rejects(localStorage(directory), /already running/); await store.set('state', { version: 1 }); assert.deepEqual(await store.get('state'), { version: 1 }); await store.close(); } finally { await rm(directory, { recursive: true, force: true }); }
});

test('observer restart restores content-free cursor and skips older tasks on migration',async()=>{
 let stored=[];const captured=[];
 const rpc={request:async name=>name==='thread/turns/list'?{data:[{id:'turn'}]}:{data:[{item:{id:'current',type:'userMessage',content:[{type:'text',text:'Current task'}]}},{item:{id:'old',type:'userMessage',content:[{type:'text',text:'Old task'}]}}]}};
 const options={rpc,onEvent:async e=>captured.push(e),getSeen:()=>stored,getTaskId:()=> 'current:task.submitted',onCheckpoint:async(_,seen)=>{stored=seen}};
 const first=new CodexObserver(options);first.attach('w');await first.poll();assert.deepEqual(captured.map(e=>e.id),['current:task.submitted']);
 const second=new CodexObserver(options);second.attach('w');await second.poll();assert.equal(captured.length,1);assert.doesNotMatch(JSON.stringify(stored),/Current task|Old task/);
});

for (const mode of ['stream-before-start', 'stream-after-start', 'completed']) {
  test(`gateway bounds ${mode} answers and interrupts only its owned turn`, async () => {
    const rpc = new EventEmitter(); const calls = [];
    const emit = (method, extra) => rpc.emit('notification', { method, params: { threadId: 'bounded', ...extra } });
    rpc.request = async (method, params) => {
      calls.push([method, params]);
      if (method === 'config/read') return { config: {} };
      if (method === 'thread/start') return { thread: { id: 'bounded' } };
      if (method === 'turn/start') {
        const answer = () => {
          if (mode !== 'completed') emit('item/agentMessage/delta', { delta: 'x'.repeat(24001) });
          emit('item/completed', { item: { type: 'agentMessage', text: mode === 'completed' ? 'x'.repeat(24001) : '{}' } });
          emit('turn/completed', { turn: { status: 'completed' } });
        };
        if (mode === 'stream-after-start') setImmediate(answer); else answer();
        return { turn: { id: 'own-turn' } };
      }
    };
    const gateway = new CodexLearningGateway({ rpc, directory: '/empty', models: [{ model: 'fixture' }] });
    await assert.rejects(gateway.generate({ role: 'orchestrator', parentSessionId: 'coding', model: { providerID: 'codex', modelID: 'fixture' }, prompt: 'Bounded JSON', onPrepared: async () => {} }), error => error.code === 'LEARNING_OUTPUT_LIMIT');
    assert.deepEqual(calls.filter(([method]) => method === 'turn/interrupt').map(([, params]) => params), [{ threadId: 'bounded', turnId: 'own-turn' }]);
    assert.equal(await gateway.recoverUsage('bounded'), null);
    assert.equal(gateway.active.size, 0);
    assert.equal(rpc.listenerCount('notification'), 0);
  });
}
test('gateway allows a larger completed content-builder artifact', async () => {
  const rpc = new EventEmitter();
  rpc.request = async method => {
    if (method === 'config/read') return { config: {} };
    if (method === 'thread/start') return { thread: { id: 'builder' } };
    if (method === 'turn/start') { queueMicrotask(() => {
      rpc.emit('notification', { method: 'item/completed', params: { threadId: 'builder', item: { type: 'agentMessage', text: 'x'.repeat(32000) } } });
      rpc.emit('notification', { method: 'turn/completed', params: { threadId: 'builder', turn: { status: 'completed' } } });
    }); return { turn: { id: 'turn' } }; }
  };
  const gateway = new CodexLearningGateway({ rpc, directory: '/empty', models: [{ model: 'fixture' }] });
  const result = await gateway.generate({ role: 'content-builder', model: { providerID: 'codex', modelID: 'fixture' }, prompt: 'Artifact', onPrepared: async () => {} });
  assert.equal(result.text.length, 32000);
});
