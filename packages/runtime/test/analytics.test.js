import { toolResponse } from '../../../scripts/fixtures/tool-response.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';
import { createAnalytics } from '../../analytics/src/posthog.js';

function fixture({ analytics, saved, fail = false } = {}) {
  let persisted = saved;
  const goal = { kind: 'core', outcome: 'Explain a retry', whyNow: 'The client changed', minutes: 3 };
  const engine = new LearningEngine({
    storage: { get: async () => structuredClone(persisted), set: async (_, value) => { persisted = structuredClone(value); } }, analytics,
    capabilities: { host: 'fixture', observation: { kinds: ['tool.succeeded'] }, model: { independent: true }, surface: { experiments: false } },
    gateway: { generate: async ({ prompt, intent }) => {
      if (fail) throw new Error('PRIVATE provider message');
      const value = intent==='goals' ? { decision: 'offer', goals: [goal] }
        : prompt.includes('HINT REQUEST') ? { hint: 'Think about a temporary failure.' }
        : prompt.includes('You are grading') ? { verdict: 'correct', evidenceLabel: 'unassisted_practice', feedback: 'A temporary failure may clear.', next: 'Consider another failure.' }
        : { decision: 'offer', kind: 'predict', title: 'Retry boundary', objective: goal.outcome, relevance: goal.whyNow, body: 'Repeat only if conditions can change.', question: 'Will a 503 retry?', rubric: 'It may clear.', hook: 'Consider the retry boundary.' };
      return { text: toolResponse(value), usage: { input: 100, output: 20 } };
    } }
  });
  return { engine, saved: () => persisted };
}
function collector() {
  const sent = [];
  const analytics = createAnalytics({ token: 'phc_test', distinctId: crypto.randomUUID(), adapter: 'fixture', surface: 'gui', fetch: async (_, req) => { sent.push(...JSON.parse(req.body).batch); return { ok: true }; } });
  return { analytics, sent };
}
test('real learning journey reports bounded outcomes and help; consent survives restart; revocation sends nothing', async () => {
  const { analytics, sent } = collector(); const h = fixture({ analytics }); const e = h.engine;
  await e.load(); await e.command({ action: 'enable' }); await analytics.flush(); assert.ok(sent.some(event => event.event === 'dd_runtime_started'));
  await e.command({ action: 'set-analytics', value: true });
  e.session('PRIVATE_NATIVE_SESSION').model = { providerID: 'private-provider', modelID: 'private-model' };
  await e.command({ action: 'surface-opened', sessionID: 'PRIVATE_NATIVE_SESSION' });
  await e.command({ action: 'suggest', sessionID: 'PRIVATE_NATIVE_SESSION' });
  await e.command({ action: 'select-goal', sessionID: 'PRIVATE_NATIVE_SESSION', value: 0 });
  await e.command({ action: 'hint', sessionID: 'PRIVATE_NATIVE_SESSION' });
  await e.command({ action: 'submit', sessionID: 'PRIVATE_NATIVE_SESSION', value: 'PRIVATE_ANSWER' });
  await e.command({ action: 'dismiss', sessionID: 'PRIVATE_NATIVE_SESSION' });
  await analytics.flush();
  for (const name of ['surface_opened', 'goals_offered', 'goal_selected', 'moment_offered', 'help_used', 'attempt_completed', 'moment_dismissed']) assert.equal(sent.filter(event => event.event === `dd_${name}`).length, 1, name);
  const attempt = sent.find(event => event.event === 'dd_attempt_completed');
  assert.ok(sent.findIndex(event => event.event === 'dd_goal_selected') < sent.findIndex(event => event.event === 'dd_moment_offered'));
  assert.equal(attempt.properties.assisted, true); assert.equal(attempt.properties.evaluation_kind, 'practice');
  assert.match(attempt.properties.session_id, /^[a-f0-9-]{36}$/);
  assert.doesNotMatch(JSON.stringify(sent), /PRIVATE|private-provider|private-model|Think about|Repeat only|It may clear/);
  const restarted = fixture({ analytics, saved: h.saved() }); await restarted.engine.load();
  assert.equal(restarted.engine.snapshot().analytics.enabled, true);
  await restarted.engine.command({ action: 'set-analytics', value: false }); await analytics.flush();
  const count = sent.length; await restarted.engine.command({ action: 'enable' }); await analytics.flush(); assert.equal(sent.length, count);
  assert.equal(restarted.saved().settings.analyticsEnabled, false); analytics.close();
});
test('broken analytics cannot block commands or hide provider failures', async () => {
  const analytics = { status: () => { throw new Error('broken'); }, setEnabled: () => { throw new Error('broken'); }, capture: async () => { throw new Error('broken'); } };
  const { engine } = fixture({ analytics, fail: true }); await engine.load(); await engine.command({ action: 'enable' });
  engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await assert.rejects(engine.command({ action: 'suggest', sessionID: 'work' }), /PRIVATE provider/);
  await engine.command({ action: 'stop' }); assert.equal(engine.state.globallyStopped, true);
});
test('model failure emits classification and duration, not the provider error content', async () => {
  const { analytics, sent } = collector(); const { engine } = fixture({ analytics, fail: true });
  await engine.load(); await engine.command({ action: 'set-analytics', value: true }); await engine.command({ action: 'enable' });
  engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await assert.rejects(engine.command({ action: 'suggest', sessionID: 'work' })); await analytics.flush();
  const failed = sent.find(event => event.event === 'dd_model_failed');
  assert.equal(sent.find(event => event.event === 'dd_command_failed')?.properties.action, 'suggest');
  assert.ok(failed); assert.ok(failed.properties.duration_ms >= 0); assert.doesNotMatch(JSON.stringify(sent), /PRIVATE/); analytics.close();
});
test('revocation wins over an earlier opt-in still waiting for storage', async () => {
  const { analytics } = collector(); let release;
  const { engine } = fixture({ analytics }); await engine.load();
  engine.storage.set = async () => new Promise(resolve => { release = resolve; });
  const enable = engine.command({ action: 'set-analytics', value: true });
  await Promise.resolve(); await Promise.resolve();
  const disable = engine.command({ action: 'set-analytics', value: false });
  release(); await enable; await Promise.resolve(); await Promise.resolve(); release(); await disable;
  assert.equal(analytics.status().enabled, false); assert.equal(engine.state.settings.analyticsEnabled, false); analytics.close();
});
test('an unresolved or rejected analytics capture never delays a learning command', async () => {
  for (const capture of [() => new Promise(() => {}), async () => { throw new Error('analytics failed'); }]) {
    const analytics = { status: () => ({ configured: true, enabled: true }), setEnabled() {}, capture };
    const { engine } = fixture({ analytics }); await engine.load();
    await engine.command({ action: 'enable' }); assert.equal(engine.state.enabled, true);
    await engine.command({ action: 'stop' }); assert.equal(engine.state.globallyStopped, true);
  }
});

test('configured anonymous metadata sharing defaults on without a saved preference', async () => {
  for (const saved of [undefined, { version: 1, settings: { sensitivity: 'learn-balanced' }, sessions: {} }]) {
    const { analytics, sent } = collector(); const h = fixture({ analytics, saved });
    await h.engine.load(); await analytics.flush();
    assert.equal(h.engine.state.settings.analyticsEnabled, true);
    assert.equal(h.engine.snapshot().analytics.enabled, true);
    assert.equal(sent[0]?.event, 'dd_runtime_started');
    analytics.close();
  }
});
test('an explicit opt-out survives restart under the new default', async () => {
  const { analytics, sent } = collector(); const h = fixture({ analytics });
  await h.engine.load(); await h.engine.command({ action: 'set-analytics', value: false });
  const restarted = fixture({ analytics, saved: h.saved() }); await restarted.engine.load();
  await analytics.flush();
  assert.equal(restarted.engine.state.settings.analyticsEnabled, false);
  assert.equal(restarted.engine.snapshot().analytics.enabled, false);
  assert.equal(sent.length, 0);
  analytics.close();
});
test('default sharing cannot send without a configured capture project', async () => {
  let requests = 0;
  const analytics = createAnalytics({ token: '', distinctId: crypto.randomUUID(), adapter: 'fixture', surface: 'gui', fetch: async () => { requests++; return { ok: true }; } });
  const h = fixture({ analytics }); await h.engine.load(); await analytics.flush();
  assert.equal(h.engine.snapshot().analytics.configured, false);
  assert.equal(h.engine.snapshot().analytics.enabled, false);
  assert.equal(requests, 0); analytics.close();
});
