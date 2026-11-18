import { toolResponse } from '../../../scripts/fixtures/tool-response.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';

for (const host of ['rich-host', 'text-host']) test(`same shared runtime works through ${host} ports and reports its limits`, async () => {
  let saved; const calls = [];
  const goal = { kind: 'core', skillId: 'skill_retry', outcome: 'Explain a retry boundary', whyNow: 'A request client is changing', minutes: 3 };
  const engine = new LearningEngine({
    storage: { get: async () => structuredClone(saved), set: async (_, value) => { saved = structuredClone(value); } },
    capabilities: { host, observation: { kinds: ['task.submitted', 'tool.succeeded'] }, model: { independent: true }, surface: { experiments: host === 'rich-host' } },
    gateway: { generate: async input => { calls.push(input); await input.onPrepared('owned'); const output = input.intent === 'goals' ? { decision: 'offer', goals: [goal] } : { tool: 'present', input: { sourceIds: ['result'], experience: { decision: 'offer', kind: 'explain', title: 'A retry boundary', objective: goal.outcome, relevance: goal.whyNow, body: 'A temporary failure may clear between otherwise identical attempts.', hook: 'Explore the retry boundary while the agent works?' } }, reason: 'This developer needs a concise mechanism before practice' }; return { text: toolResponse(output), usage: { input: 12, output: 8 } }; } }
  });
  await engine.load(); await engine.command({ action: 'enable' });
  engine.session('work').model = { providerID: 'fixture', modelID: 'model' };
  await engine.onWorkEvent({ id: 'result', sessionId: 'work', type: 'tool.succeeded', data: { content: 'A 503 is retried' } });
  await engine.onWorkEvent({ id: 'unsupported', sessionId: 'work', type: 'private.reasoning', data: { content: 'must be ignored' } });
  await engine.command({ action: 'suggest', sessionID: 'work' });
  const snap = await engine.command({ action: 'select-goal', sessionID: 'work', value: 0 });
  assert.equal(snap.session.moment.kind, 'explain'); assert.equal(snap.session.trace.length, 1);
  if (host === 'text-host') assert.equal(snap.session.nextMoves.some(m => ['try-it', 'see-how-it-works'].includes(m.id)), false);
  assert.equal(snap.capabilities.host, host);
  assert.equal(snap.capabilities.surface.experiments, host === 'rich-host');
  assert.match(calls.at(-1).prompt, host === 'rich-host' ? /build_interactive/ : /Interactive building is unavailable/);
  await engine.command({ action: 'disable' });
  await engine.onWorkEvent({ id: 'off', sessionId: 'work', type: 'tool.succeeded', data: { content: 'must be ignored' } });
  assert.equal(engine.session('work').trace.length, 1);
});
