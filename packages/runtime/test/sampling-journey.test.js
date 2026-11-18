import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';
import { toolResponse } from '../../../scripts/fixtures/tool-response.mjs';
const goals = { decision: 'offer', goals: [{ kind: 'core', outcome: 'Explain bounded retries', whyNow: 'retry.js limits retries', minutes: 2 }] };
const tick = async () => { for (let i=0;i<12;i++) await new Promise(resolve => setImmediate(resolve)); };
async function fixture(generate = () => toolResponse(goals), saved = null) {
  const prompts = []; let stored = saved;
  const engine = new LearningEngine({ storage: { get: async () => structuredClone(stored), set: async (_, value) => { stored = structuredClone(value); } },
    capabilities: { host: 'fixture', observation: { kinds: ['task.submitted', 'turn.started', 'turn.completed', 'assistant.delta', 'reasoning.ended', 'tool.succeeded', 'file.changed'] }, model: { independent: true }, surface: { experiments: false } },
    gateway: { generate: async ({ prompt }) => { prompts.push(prompt); return { text: await generate(prompt, prompts.length), usage: { input: 25, output: 10 } }; } } });
  await engine.load(); if (!engine.state.enabled) await engine.command({ action: 'enable' }); engine.session('work').model = { providerID: 'p', modelID: 'm' };
  const send = async (id, type, data = {}) => { await engine.onWorkEvent({ id, type, sessionId: 'work', data }); await tick(); };
  return { engine, prompts, send, saved: () => stored };
}
test('early goals refine from a file change while streamed/repeated reasoning never makes calls', async () => {
  const f = await fixture();
  await f.send('task', 'task.submitted', { text: 'Implement bounded retries' });
  await f.send('start', 'turn.started');
  assert.equal(f.prompts.length, 1);
  for (let i=0;i<30;i++) {
    await f.send(`delta${i}`, 'assistant.delta', { text: 'STREAM_ONLY' });
    await f.send(`thought${i}`, 'reasoning.ended', { text: 'SPECULATION_ONLY' });
  }
  assert.equal(f.prompts.length, 1);
  await f.send('file', 'file.changed', { path: 'retry.js', diff: '+ attempts < 3; retry 503' });
  assert.equal(f.prompts.length, 2);
  assert.match(f.prompts[1], /attempts < 3/);
  assert.match(f.prompts[1], /previousGoals/);
  assert.doesNotMatch(f.prompts[1], /STREAM_ONLY/);
  await f.send('file-duplicate', 'file.changed', { path: 'retry.js', diff: '+ attempts < 3; retry 503' });
  await f.send('complete', 'turn.completed');
  assert.equal(f.prompts.length, 2);
  assert.equal(f.engine.session('work').learningCosts.goals.input, 50);
});
test('a consumed work update is not resent after restart or an empty next turn', async () => {
  const f = await fixture(); await f.send('source', 'tool.succeeded', { path: 'retry.js', content: 'Bound retries to 3' });
  const restarted = await fixture(undefined, f.saved());
  await restarted.send('start', 'turn.started'); await restarted.send('done', 'turn.completed');
  assert.equal(restarted.prompts.length, 0);
  await restarted.send('source-again', 'tool.succeeded', { path: 'retry.js', content: 'Bound retries to 3' });
  assert.equal(restarted.prompts.length, 0);
});
test('follow-up calls reuse a compact frozen lesson and can retrieve specific captured details', async () => {
  let calls = 0;
  const f = await fixture(prompt => {
    if (!calls++) { assert.doesNotMatch(prompt, /DETAIL_ONLY/); return JSON.stringify({ tool: 'retrieve_work', input: { ids: ['frozen'] }, reason: 'Inspect the specific mechanism' }); }
    assert.match(prompt, /DETAIL_ONLY/);
    return toolResponse({ answer: 'A bound stops repeated attempts.' });
  });
  const s = f.engine.session('work');
  s.moment = { id: 'm', kind: 'predict', title: 'Retry boundary', objective: 'Explain bounded retries', body: 'A retry repeats an operation.', question: 'What stops it?', rubric: 'Attempts are bounded.', snapshot: [{ id: 'frozen', type: 'tool.succeeded', data: { path: 'retry.js', content: 'a'.repeat(400) + 'DETAIL_ONLY' + 'z'.repeat(400) } }], assistance: [] };
  const original = structuredClone(s.moment.snapshot);
  await f.send('later', 'file.changed', { path: 'other.js', content: 'Unrelated newer work' });
  await f.engine.command({ action: 'ask', sessionID: 'work', value: 'Show the mechanism' });
  assert.equal(f.prompts.length, 2); assert.deepEqual(s.moment.snapshot, original);
  assert.equal(s.moment.question, 'What stops it?'); assert.equal(s.learningCosts.ask.calls, 2);
});
test('ignored stream traffic causes no model call, storage write or surface update', async () => {
  const f = await fixture(); let writes = 0; let updates = 0;
  f.engine.storage.set = async () => { writes++; }; f.engine.emit = async () => { updates++; };
  for (let i=0;i<100;i++) await f.engine.onWorkEvent({ id: `d${i}`, type: 'assistant.delta', sessionId: 'work', data: { text: 'stream' } });
  assert.equal(f.prompts.length, 0); assert.equal(writes, 0); assert.equal(updates, 0);
});
test('manual refresh can inspect current evidence even after its automatic update was consumed', async () => {
  const f = await fixture(); await f.send('file', 'file.changed', { path: 'retry.js', diff: '+ UNIQUE_CURRENT_EVIDENCE' });
  await f.engine.command({ action: 'suggest', sessionID: 'work' });
  assert.match(f.prompts.at(-1), /UNIQUE_CURRENT_EVIDENCE/);
});
test('sampling telemetry contains counts and model intent, never work text or file paths', async () => {
  const { createAnalytics } = await import('../../analytics/src/posthog.js'); const sent = [];
  const analytics = createAnalytics({ token: 'phc_fixture', distinctId: crypto.randomUUID(), adapter: 'fixture', surface: 'gui', environment: 'test', fetch: async (_, req) => { sent.push(...JSON.parse(req.body).batch); return { ok: true }; } });
  const f = await fixture(); f.engine.analytics = analytics; analytics.setEnabled(true);
  await f.send('file', 'file.changed', { path: 'PRIVATE_PATH.js', diff: '+ PRIVATE_WORK' });
  await analytics.flush();
  assert.equal(sent.find(e => e.event === 'dd_work_sampled').properties.selected_events, 1);
  assert.equal(sent.find(e => e.event === 'dd_model_completed').properties.intent, 'goals');
  assert.doesNotMatch(JSON.stringify(sent), /PRIVATE_PATH|PRIVATE_WORK/); analytics.close();
});
