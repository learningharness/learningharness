import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ToolRegistry } from '../../../packages/runtime/src/tool-registry.js';
import { runCodexToolCycle } from '../src/native-tool-cycle.js';
import { CodexLearningGateway } from '../src/model-gateway.js';

function fixture(run) {
  const rpc = new EventEmitter(), requests = []; let handler;
  const emit = (method, params) => rpc.emit('notification', { method, params: { threadId: 'owned', ...params } });
  rpc.bindLearningTools = (threadId, tools, fn) => { assert.equal(threadId, 'owned'); handler = fn; return () => { handler = null; }; };
  const call = (tool = 'finish', args = {}, overrides = {}) => handler({ threadId: 'owned', turnId: 'turn', callId: 'call', tool, arguments: args, ...overrides });
  rpc.request = async (method, params) => {
    requests.push({ method, params });
    if (method === 'config/read') return { config: { mcp_servers: { private: { env: { SECRET: 'NEVER_COPY' } } } } };
    if (method === 'thread/start') return { thread: { id: 'owned' } };
    if (method === 'turn/interrupt') { emit('turn/completed', { turn: { status: 'interrupted' } }); return {}; }
    if (method === 'turn/start') {
      emit('turn/started', { turn: { id: 'turn' } });
      setImmediate(() => { void run({ call, emit, rpc }).catch(() => {}); });
      return { turn: { id: 'turn' } };
    }
    return {};
  };
  let executions = 0;
  const registry = new ToolRegistry().register({ name: 'finish', terminal: true, description: 'One proposal', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: async () => { executions++; return { answer: 'proposed' }; } });
  const states = [];
  return { rpc, requests, registry, executions: () => executions, states,
    options: { rpc, directory: '/empty', model: 'fixture', registry, prompt: 'Synthetic', onCheckpoint: async s => states.push(s) } };
}
test('native cycle returns one validated proposal and cumulative host usage after real continuation', async () => {
  const f = fixture(async ({ call, emit }) => {
    assert.equal((await call()).success, true);
    emit('thread/tokenUsage/updated', { tokenUsage: { last: { inputTokens: 4, outputTokens: 2 }, total: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 30 } } });
    emit('item/agentMessage/delta', { delta: 'done' }); emit('turn/completed', { turn: { status: 'completed' } });
  });
  const events = []; const result = await runCodexToolCycle({ ...f.options, onEvent: e => events.push(e) });
  assert.equal(f.executions(), 1); assert.equal(result.usage.input, 100); assert.equal(result.usage.cache.read, 30);
  assert.equal(f.states.at(-1).status, 'completed'); assert.ok(events.some(e => e.type === 'text_delta'));
  const start = f.requests.find(r => r.method === 'thread/start').params;
  assert.equal(start.ephemeral, true); assert.deepEqual(start.environments, []); assert.doesNotMatch(JSON.stringify(start), /NEVER_COPY/);
  assert.equal(f.rpc.listenerCount('notification'), 0);
});
test('cancellation at streamed text rejects publication and interrupts only the owned turn', async () => {
  const controller = new AbortController();
  const f = fixture(async ({ emit }) => { emit('item/agentMessage/delta', { delta: 'partial' }); });
  await assert.rejects(runCodexToolCycle({ ...f.options, signal: controller.signal, onEvent: () => controller.abort() }), /cancel/i);
  assert.equal(f.executions(), 0); assert.equal(f.states.at(-1).status, 'interrupted');
  assert.equal(f.states.at(-1).hostStatus, 'interrupted'); assert.equal(f.states.at(-1).interruptAcknowledged, true);
  assert.ok(f.requests.filter(r => r.method === 'turn/interrupt').every(r => r.params.threadId === 'owned' && r.params.turnId === 'turn'));
});
test('replayed or foreign-turn tool requests never execute', async () => {
  for (const overrides of [{ turnId: 'foreign' }, { callId: '' }]) {
    const f = fixture(async ({ call }) => { await call('finish', {}, overrides); });
    await assert.rejects(runCodexToolCycle(f.options), /Invalid or replayed/); assert.equal(f.executions(), 0);
  }
  const f = fixture(async ({ call }) => { await call(); await call(); });
  await assert.rejects(runCodexToolCycle(f.options), /replayed/); assert.equal(f.executions(), 1);
});
test('disconnect, invalid input and unfinished turns produce interrupted journals', async () => {
  const disconnected = fixture(async ({ rpc }) => rpc.emit('disconnected'));
  await assert.rejects(runCodexToolCycle(disconnected.options), /disconnected/);
  assert.equal(disconnected.states.at(-1).status, 'interrupted');
  const invalid = fixture(async ({ call, emit }) => { assert.equal((await call('finish', { extra: true })).success, false); emit('turn/completed', { turn: { status: 'completed' } }); });
  await assert.rejects(runCodexToolCycle(invalid.options), /without a validated/); assert.equal(invalid.executions(), 0);
  const hanging = fixture(async () => {});
  await assert.rejects(runCodexToolCycle({ ...hanging.options, timeoutMs: 10 }), /timed out/);
});
test('terminal journal failure cannot become a successful native result', async () => {
  const f = fixture(async ({ call, emit }) => { await call(); emit('turn/completed', { turn: { status: 'completed' } }); });
  await assert.rejects(runCodexToolCycle({ ...f.options, onCheckpoint: async state => { if (state.status === 'running' && state.results.length) throw Error('Journal unavailable'); } }), /Journal unavailable/);
});
test('a failing stream consumer interrupts the owned turn instead of escaping the event listener', async () => {
  const f = fixture(async ({ emit }) => { emit('item/agentMessage/delta', { delta: 'text' }); });
  await assert.rejects(runCodexToolCycle({ ...f.options, onEvent: () => { throw Error('Consumer unavailable'); } }), /Consumer unavailable/);
  assert.equal(f.states.at(-1).hostStatus, 'interrupted'); assert.equal(f.executions(), 0);
});
test('cancellation after tool execution cannot acknowledge a successful late tool result', async () => {
  const controller = new AbortController(); let response;
  const f = fixture(async ({ call }) => { try { response = await call(); } catch {} });
  await assert.rejects(runCodexToolCycle({ ...f.options, signal: controller.signal, onEvent: e => { if (e.type === 'tool_finished') controller.abort(); } }), /cancel/i);
  assert.equal(response, undefined); assert.equal(f.states.at(-1).status, 'interrupted');
});
test('native allocation includes both the first response and terminal acknowledgement', async () => {
  const f = fixture(async ({ call }) => { await call(); });
  await assert.rejects(runCodexToolCycle({ ...f.options, maxRequests: 1 }), /allocation exhausted/);
  assert.equal(f.states.at(-1).status, 'interrupted');
});
test('gateway native execution preserves prepared identity, cycle proposal and cumulative usage', async () => {
  const f = fixture(async ({ call, emit }) => { await call(); emit('thread/tokenUsage/updated', { tokenUsage: { total: { inputTokens: 100, outputTokens: 20 } } }); emit('turn/completed', { turn: { status: 'completed' } }); });
  const gateway = new CodexLearningGateway({ rpc: f.rpc, directory: '/empty', models: [{ model: 'fixture' }] }); let prepared;
  const result = await gateway.generate({ parentSessionId: 'work', model: { providerID: 'codex', modelID: 'fixture' }, prompt: 'Synthetic', execution: { registry: f.registry, maxRequests: 2 }, onPrepared: async id => { prepared = id; } });
  assert.equal(prepared, 'owned'); assert.equal(result.cycle.value.answer, 'proposed'); assert.equal(result.usage.input, 100); assert.equal(gateway.active.size, 0);
});
test('gateway cancellation targets the requested native parent and keeps missing usage unknown', async () => {
  let begun; const started = new Promise(resolve => { begun = resolve; });
  const f = fixture(async () => { begun(); });
  const gateway = new CodexLearningGateway({ rpc: f.rpc, directory: '/empty', models: [{ model: 'fixture' }] });
  const pending = gateway.generate({ parentSessionId: 'work', model: { providerID: 'codex', modelID: 'fixture' }, prompt: 'Synthetic', execution: { registry: f.registry, maxRequests: 2 }, onPrepared: async () => {} });
  await started; await gateway.cancel('other'); assert.equal(f.requests.filter(r => r.method === 'turn/interrupt').length, 0);
  await gateway.cancel('work'); const result = await pending;
  assert.match(result.executionError.message, /cancel/i); assert.equal(result.usage, null); assert.equal(gateway.active.size, 0);
});
