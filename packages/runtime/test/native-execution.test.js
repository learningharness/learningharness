import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';

const caps = { host: 'codex', observation: { kinds: [] }, model: { independent: true }, surface: { experiments: true } };
async function fixture(generate, options = {}) {
  let saved;
  const gateway = { supportsNativeTools: true, generate, cancel: async () => {} };
  const engine = new LearningEngine({ storage: { get: async () => saved, set: async (_, s) => { saved = structuredClone(s); } }, gateway, capabilities: caps, executionMode: 'native', defaultLearningModel: { providerID: 'codex', modelID: 'fixture' }, ...options });
  await engine.load(); await engine.command({ action: 'enable' });
  return { engine, saved: () => saved, gateway };
}
const goals = [{ kind: 'core', outcome: 'Atomic replacement', whyNow: 'The persistence code changed', minutes: 2, insight: 'Rename protects whole-file reads; serialization protects updates.' }];
function nativeResult(value, usage = { input: 100, output: 20 }) { return { text: JSON.stringify(value), usage, cycle: { value, trace: [{ tool: 'suggest_goals' }] } }; }
test('native execution uses the same registry, publishes validated goals and settles host usage once', async () => {
  let native = false;
  const { engine } = await fixture(async input => {
    native = Boolean(input.execution);
    await input.onPrepared('native-owned');
    const result = await input.execution.registry.execute({ tool: 'suggest_goals', input: { goals }, reason: 'Relevant learning' }, { check: input.execution.check });
    return nativeResult(result.value);
  });
  await engine.command({ action: 'suggest', sessionID: 'work' });
  assert.equal(native, true); assert.equal(engine.session('work').goals.list[0].outcome, goals[0].outcome);
  assert.equal(engine.state.usage.input, 100); assert.equal(engine.state.usage.calls, 1);
  assert.equal(Object.values(engine.state.ledger)[0].learningSessionId, 'native-owned');
});
test('nested native builders share accounting without deadlocking the serialized outer call', async () => {
  const { engine } = await fixture(async input => {
    await input.onPrepared(input.execution ? 'native' : 'builder');
    if (!input.execution) return { text: 'A scaffold', usage: { input: 30, output: 10 } };
    const draft = await input.execution.request('Draft a scaffold', 'content-builder');
    const result = await input.execution.registry.execute({ tool: 'answer_question', input: { answer: draft }, reason: 'Help the learner' }, { check: input.execution.check });
    return nativeResult(result.value);
  });
  let timer;
  try {
    const result = await Promise.race([engine.runLearningIntent('work', { intent: 'ask', prompt: 'Explain replacement', trace: [] }), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Deadlock')), 1000); })]);
    assert.equal(result.answer, 'A scaffold'); assert.equal(engine.state.usage.input, 130); assert.equal(engine.state.usage.calls, 2);
    assert.equal(Object.values(engine.state.ledger).filter(x => x.status === 'settled').length, 2);
    assert.equal(engine.session('work').pendingUsage, false);
  } finally { clearTimeout(timer); }
});
test('a native result arriving after pause retains measured usage but never publishes', async () => {
  let finish, begun; const started = new Promise(resolve => { begun = resolve; });
  const { engine } = await fixture(async input => {
    begun(); await new Promise(resolve => { finish = resolve; });
    return nativeResult({ decision: 'offer', goals });
  });
  const pending = engine.command({ action: 'suggest', sessionID: 'work' }); await started;
  await engine.command({ action: 'pause', sessionID: 'work' }); finish(); await pending.catch(() => {});
  assert.equal(engine.session('work').goals, null); assert.equal(engine.state.usage.input, 100);
});
test('native usage cannot fall back to a misleading single-prompt estimate', async () => {
  const { engine } = await fixture(async () => ({ ...nativeResult({ decision: 'offer', goals }, null), reportedUsage: { input: 50, output: 10 } }));
  await assert.rejects(engine.command({ action: 'suggest', sessionID: 'work' }), /usage/i);
  assert.equal(engine.state.usage.input, 0); assert.equal(engine.state.usage.unreportedCalls, 1);
  assert.equal(Object.values(engine.state.ledger)[0].reportedUsage.input, 50);
});
test('native automatic cycles reserve their full request allocation in the existing rolling budget', async () => {
  const { engine } = await fixture(async input => {
    const result = await input.execution.registry.execute({ tool: 'suggest_goals', input: { goals }, reason: 'Relevant' }, { check: input.execution.check });
    return nativeResult(result.value);
  }, { maxAutomaticChecksPerWindow: 3, maxGoalRequests: 2 });
  await engine.runLearningIntent('work', { intent: 'goals', prompt: 'Current work', automatic: true, trace: [] });
  assert.equal(engine.session('work').automaticCheckTimes.length, 2);
  await assert.rejects(engine.runLearningIntent('work', { intent: 'goals', prompt: 'Current work', automatic: true, trace: [] }), /budget/);
});
test('inclusive Codex usage is not counted twice with cached input or reasoning output', async () => {
  const { engine } = await fixture(async input => {
    const result = await input.execution.registry.execute({ tool: 'suggest_goals', input: { goals }, reason: 'Relevant' }, { check: input.execution.check });
    return nativeResult(result.value, { input: 100, output: 20, reasoning: 5, cache: { read: 30, write: 10 }, inputIncludesCache: true, outputIncludesReasoning: true });
  });
  await engine.command({ action: 'suggest', sessionID: 'work' });
  assert.equal(engine.state.usage.input, 100); assert.equal(engine.state.usage.output, 20);
});
