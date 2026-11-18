import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningTools } from '../src/learning-tools.js';
import { goalsPrompt, LearningEngine } from '../src/learning-engine.js';
test('opportunity decisions have two terminal tools and a compact prompt, with no retrieval loop', () => {
  const tools = createLearningTools({ intent: 'goals' }).describe();
  assert.deepEqual(tools.map(x => x.name), ['suggest_goals', 'stay_silent']);
  const prompt = goalsPrompt([{ id: 'task', type: 'task.submitted', data: { text: 'Build a retry helper' } }], [], { topics: [] });
  assert.ok(prompt.length < 1800);
});
test('trial cap permits one automatic decision per task despite later evidence and turn changes', async () => {
  let calls = 0;
  const engine = new LearningEngine({ storage: { get: async () => null, set: async () => {} }, gateway: { generate: async () => { calls++; return { text: '{"tool":"stay_silent","input":{"reason":"No useful intervention"},"reason":"No useful intervention"}', usage: { input: 10, output: 10 } }; } }, defaultLearningModel: { providerID: 'fixture', modelID: 'fixture' }, debounceMs: 60000, maxAutomaticChecksPerTask: 1, maxGoalRequests: 1, capabilities: { host: 'fixture', observation: { kinds: ['task.submitted', 'file.changed', 'turn.started'] }, model: { independent: true }, surface: { experiments: false } } });
  await engine.load(); await engine.command({ action: 'enable' });
  const event = (id, type, data) => engine.onWorkEvent({ id, sessionId: 'work', type, data });
  try {
    await event('task1', 'task.submitted', { text: 'Build retry handling' }); await engine.consider('work');
    await event('file1', 'file.changed', { path: 'retry.ts', content: 'new work' }); await event('turn2', 'turn.started', {}); await engine.consider('work');
    assert.equal(calls, 1);
    await event('task2', 'task.submitted', { text: 'Implement response caching' }); await engine.consider('work'); assert.equal(calls, 2);
  } finally { for (const timer of engine.parallelTimers.values()) clearTimeout(timer); }
});
test('personal trial bounds user-initiated teaching loops to their configured request budget', async () => {
  let calls = 0;
  const engine = new LearningEngine({ storage: { get: async () => null, set: async () => {} }, gateway: { generate: async () => { calls++; return { text: '{"tool":"retrieve_learner","input":{},"reason":"Inspect learner"}', usage: { input: 10, output: 10 } }; } }, defaultLearningModel: { providerID: 'fixture', modelID: 'fixture' }, maxLearningRequests: 3, capabilities: { host: 'fixture', observation: { kinds: [] }, model: { independent: true }, surface: { experiments: false } } });
  await engine.load(); await engine.command({ action: 'enable' });
  await assert.rejects(engine.runLearningIntent('work', { intent: 'ask', prompt: 'Explain the work' }), /budget exhausted/);
  assert.equal(calls, 3);
});
