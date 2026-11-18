import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';
import { createLearningTools } from '../src/learning-tools.js';
const goal = { kind: 'core', outcome: 'Explain a retry boundary', whyNow: 'The request helper classifies failures', minutes: 3 };
async function fixture(reply, options = {}) {
  let calls = 0; const events = []; const cancelled = [];
  const engine = new LearningEngine({ storage: { get: async () => null, set: async () => {} }, capabilities: { host: 'fixture', observation: { kinds: ['tool.succeeded'] }, model: { independent: true }, surface: { experiments: false } },
    gateway: { generate: async input => { calls++; return reply(input, calls); }, cancel: async id => { cancelled.push(id); } }, diagnostics: { record: entry => events.push(entry) }, ...options });
  await engine.load(); await engine.command({ action: 'enable' }); engine.session('work').model = { providerID: 'fixture', modelID: 'fixture' };
  return { engine, calls: () => calls, events, cancelled };
}
const result = goals => ({ text: JSON.stringify({ tool: 'suggest_goals', input: { goals }, reason: 'A mechanism in the current work' }), usage: { input: 30, output: 20 } });
test('malformed optional skill metadata cannot block valid learning goals', async () => {
  const f = await fixture(() => result([{ ...goal, skillId: 'http retry: classifier' }]));
  await f.engine.command({ action: 'suggest', sessionID: 'work' });
  assert.equal(f.calls(), 1); assert.equal(f.engine.session('work').goals.list[0].outcome, goal.outcome);
  assert.match(f.engine.session('work').goals.list[0].skillId, /^skill_[a-zA-Z0-9_-]+$/);
});
test('goal tools advertise the actual field contract and actionable bounds', () => {
  const registry = createLearningTools({ intent: 'goals' });
  const schema = registry.describe().find(t => t.name === 'suggest_goals').inputSchema.properties.goals.items;
  assert.equal(schema.properties.outcome.maxLength, 80); assert.equal(schema.properties.whyNow.maxLength, 160);
  assert.ok(schema.required.includes('kind')); assert.ok(schema.required.includes('minutes'));
});
test('repeated invalid model replies stop after one repair, with a fault instead of indefinite preparing', async () => {
  const f = await fixture(() => result([{ ...goal, outcome: 'x'.repeat(81) }]));
  await assert.rejects(f.engine.command({ action: 'suggest', sessionID: 'work' }), /validation|bounds/);
  assert.equal(f.calls(), 2); assert.equal(f.engine.session('work').phase, 'fault');
  assert.ok(f.events.some(e => e.event === 'tool_rejected'));
});
test('a hung learning call times out, cancels only its learning session, and cannot publish late', async () => {
  let release;
  const f = await fixture(() => new Promise(resolve => { release = resolve; }), { learningTimeoutMs: 20 });
  await assert.rejects(f.engine.command({ action: 'suggest', sessionID: 'work' }), /timed out/);
  assert.deepEqual(f.cancelled, ['work']); assert.equal(f.engine.session('work').phase, 'fault');
  assert.ok(f.events.some(e => e.event === 'model_timeout'));
  release(result([goal])); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.engine.session('work').goals, null);
});
test('one malformed goal response can repair successfully and records safe progress', async () => {
  const f = await fixture((_, count) => result([{ ...goal, outcome: count === 1 ? 'x'.repeat(81) : goal.outcome }]));
  await f.engine.command({ action: 'suggest', sessionID: 'work' });
  assert.equal(f.calls(), 2); assert.equal(f.engine.session('work').phase, 'goals');
  assert.equal(f.engine.session('work').learningActivity, null);
  assert.ok(f.events.some(e => e.event === 'tool_rejected' && e.error === 'bounds'));
  assert.ok(f.events.some(e => e.event === 'cycle_completed'));
  assert.doesNotMatch(JSON.stringify(f.events), /classifies failures|Explain a retry boundary/);
});
test('broken diagnostics cannot prevent a useful goal or expose unbounded local history', async () => {
  const f = await fixture(() => result([goal]), { diagnostics: { record() { throw new Error('PRIVATE_LOGGER_ERROR'); } } });
  await f.engine.command({ action: 'suggest', sessionID: 'work' });
  for (let i=0;i<100;i++) f.engine.record('model_started', 'work', { intent: 'goals', inputBytes: i });
  assert.equal(f.engine.session('work').diagnostics.length, 40); assert.equal(f.engine.session('work').phase, 'goals');
});
test('restart clears stale preparing activity and marks its unfinished journal interrupted', async () => {
  const f = await fixture(() => result([goal])); const saved = structuredClone(f.engine.state);
  Object.assign(saved.sessions.work, { phase: 'considering', learningActivity: { stage: 'repair', attempt: 5 }, agentRun: { id: 'old', status: 'running' } });
  f.engine.storage.get = async () => saved;
  await f.engine.load();
  assert.equal(f.engine.session('work').learningActivity, null);
  assert.equal(f.engine.session('work').agentRun.status, 'interrupted');
  assert.equal(f.engine.session('work').phase, 'observing');
});
test('a fault in another coding session cannot hide healthy goals', async () => {
  const f = await fixture(() => result([goal])); await f.engine.command({ action: 'suggest', sessionID: 'work' });
  await f.engine.fail(new Error('Other learning request timed out'), 'other');
  assert.equal(f.engine.snapshot('work').fault, null);
  assert.equal(f.engine.snapshot('work').session.phase, 'goals');
  assert.ok(f.engine.snapshot('other').fault);
});
test('repair is not dispatched when too little of the cycle deadline remains', async () => {
  const f = await fixture(async () => { await new Promise(resolve => setTimeout(resolve, 15)); return { text: '{"tool":"suggest_goals","input":', usage: { input: 30, output: 10 } }; }, { learningTimeoutMs: 200 });
  await assert.rejects(f.engine.command({ action: 'suggest', sessionID: 'work' }), /timed out|time remaining/);
  assert.equal(f.calls(), 1);
});
test('learning model override persists independently of the coding model and clears to configured default', async () => {
  const chosen = [];
  const configured = { providerID: 'free', modelID: 'configured' };
  const f = await fixture(input => { chosen.push(input.model); return result([goal]); }, { defaultLearningModel: configured });
  const original = structuredClone(f.engine.session('work').model);
  const preference = { providerID: 'free', modelID: 'preferred' };
  await f.engine.command({ action: 'set-learning-model', value: preference });
  await f.engine.command({ action: 'suggest', sessionID: 'work' });
  assert.deepEqual(chosen[0], preference);
  const saved = structuredClone(f.engine.state); f.engine.storage.get = async () => saved;
  await f.engine.load(); assert.deepEqual(await f.engine.resolveModel('work'), preference);
  await f.engine.command({ action: 'set-learning-model', value: null });
  assert.deepEqual(await f.engine.resolveModel('work'), configured);
  assert.deepEqual(f.engine.session('work').model, original);
});
test('opportunity deadline is independent of the longer lesson deadline', async () => {
  const f = await fixture(() => new Promise(() => {}), { opportunityTimeoutMs: 20, learningTimeoutMs: 45000 });
  const start = performance.now();
  await assert.rejects(f.engine.command({ action: 'suggest', sessionID: 'work' }), /timed out/);
  assert.ok(performance.now() - start < 2000); assert.equal(f.calls(), 1);
});
test('quota failure preserves already useful goals and provides an actionable safe category', async () => {
  let fail = false;
  const f = await fixture(() => { if (fail) throw new Error('Free usage limit reached. PRIVATE_PROVIDER_PAYLOAD'); return result([goal]); });
  await f.engine.command({ action: 'suggest', sessionID: 'work' }); fail = true;
  await assert.rejects(f.engine.command({ action: 'suggest', sessionID: 'work' }), /Free usage/);
  assert.equal(f.engine.snapshot('work').fault.kind, 'quota');
  assert.equal(f.engine.session('work').goals.list[0].outcome, goal.outcome);
  assert.equal(f.engine.session('work').phase, 'goals');
  assert.doesNotMatch(JSON.stringify(f.events), /PRIVATE_PROVIDER/);
});
test('changing learning model recovers observation after a provider fault without resuming stopped learning', async () => {
  const f = await fixture(() => result([goal]));
  await f.engine.fail(new Error('Free usage limit reached'), 'work');
  await f.engine.command({ action: 'stop' });
  await f.engine.command({ action: 'set-learning-model', value: { providerID: 'free', modelID: 'next' } });
  assert.equal(f.engine.snapshot('work').fault, null);
  assert.equal(f.engine.session('work').phase, 'observing');
  assert.equal(f.engine.state.enabled, false);
  await assert.rejects(f.engine.command({ action: 'set-learning-model', value: { providerID: {}, modelID: 'next' } }));
});

test('a useful 12-second goal response survives normal provider latency without adding calls',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let release;
 const f=await fixture(()=>new Promise(resolve=>{release=resolve;}));
 const pending=f.engine.command({action:'suggest',sessionID:'work'});
 await new Promise(resolve=>setImmediate(resolve));
 t.mock.timers.tick(12000);
 release(result([goal]));
 await pending;
 assert.equal(f.engine.session('work').goals.list[0].outcome,goal.outcome);
 assert.equal(f.calls(),1);assert.deepEqual(f.cancelled,[]);
});

test('an invitation still stops at its bounded deadline and rejects late content',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let release;
 const f=await fixture(()=>new Promise(resolve=>{release=resolve;}));
 const pending=f.engine.command({action:'suggest',sessionID:'work'});
 const stopped=assert.rejects(pending,/timed out/);
 await new Promise(resolve=>setImmediate(resolve));
 t.mock.timers.tick(21000);
 await stopped;
 release(result([goal]));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.engine.session('work').goals,null);assert.equal(f.calls(),1);assert.deepEqual(f.cancelled,['work']);
});
