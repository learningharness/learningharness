import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';
const goal = { kind: 'core', outcome: 'Explain retry conditions', whyNow: 'The request client changed', minutes: 3 };
const question = { decision: 'offer', kind: 'predict', title: 'A retry condition', objective: goal.outcome, relevance: goal.whyNow, body: 'A repeated request helps only when conditions can change.', question: 'Can a temporary 503 clear?', rubric: 'A temporary service failure may clear.', hook: 'Explore the retry condition while the agent works?' };
const tool = (tool, input) => JSON.stringify({ tool, input, reason: 'Adapt to this learner and the captured work' });
function fixture(provider) {
  let saved; const calls = [];
  const storage = { get: async () => structuredClone(saved), set: async (_, value) => { saved = structuredClone(value); } };
  const gateway = { generate: async input => { calls.push(input); return { text: await provider(input), usage: { input: 30, output: 20 } }; } };
  const engine = new LearningEngine({ storage, gateway, capabilities: { host: 'fixture', observation: { kinds: [] }, model: { independent: true }, surface: { experiments: true } } });
  return { engine, calls, storage, gateway };
}
test('goals, delegated question, hint, Ask, assessment and recap all execute through the same tool loop', async () => {
  const h = fixture(async ({ prompt, role }) => {
    if (role === 'content-builder') return JSON.stringify(question);
    const intent = prompt.match(/LEARNING INTENT: (\w+)/)?.[1];
    assert.ok(intent, 'Every generation request enters the common intent protocol');
    if (intent === 'goals') return tool('suggest_goals', { goals: [goal] });
    if (intent === 'moment') return prompt.includes('"artifactId":"artifact_1"') ? tool('present', { artifactId: 'artifact_1', sourceIds: [] }) : tool('create_question', { brief: 'Probe whether the failure can clear between attempts' });
    if (intent === 'hint') return prompt.includes('"tool":"retrieve_learner","result"') ? tool('provide_hint', { hint: 'Compare a temporary outage with unchanged credentials.' }) : tool('retrieve_learner', {});
    if (intent === 'ask') return tool('answer_question', { answer: 'A retry repeats the request under potentially changed conditions.' });
    if (intent === 'assessment') return tool('assess_answer', { verdict: 'correct', feedback: 'You identified the changing condition.', next: 'Consider another failure category.' });
    if (intent === 'recap') return tool('create_recap', { recap: 'You practiced retry conditions with help. Try a fresh case later.' });
    throw new Error('Unexpected intent');
  });
  const e = h.engine; await e.load(); await e.command({ action: 'enable' }); e.session('work').model = { providerID: 'fixture', modelID: 'fixture' };
  await e.command({ action: 'suggest', sessionID: 'work' });
  await e.command({ action: 'select-goal', sessionID: 'work', value: 0 });
  assert.deepEqual(e.session('work').agentTrace.map(x => x.tool), ['create_question', 'present']);
  await e.command({ action: 'save-draft', sessionID: 'work', value: { momentId: e.session('work').moment.id, answer: 'My draft', choice: '' } });
  await e.command({ action: 'hint', sessionID: 'work' });
  assert.deepEqual(e.session('work').agentTrace.map(x => x.tool), ['retrieve_learner', 'provide_hint']);
  await e.command({ action: 'ask', sessionID: 'work', value: 'What does retry mean?' });
  assert.equal(e.session('work').draft.answer, 'My draft');
  const snap = await e.command({ action: 'submit', sessionID: 'work', value: 'Yes, it may clear.' });
  assert.equal(snap.session.evidence[0].assisted, true); assert.equal(snap.session.evidence[0].evidenceLabel, 'practiced_with_assistance');
  assert.equal('agentRun' in snap.session, false, 'Private tool results/rubrics never reach the surface status');
  await e.command({ action: 'recap', sessionID: 'work' });
  assert.match(e.session('work').recap.text, /with help/); assert.equal(e.session('work').agentRun.status, 'completed');
  assert.ok(h.calls.every(call => call.role === 'content-builder' || call.prompt.includes('REGISTERED TOOLS:')));
});
test('assessment intent cannot invoke a presentation tool to replace the pending question', async () => {
  const h = fixture(async () => tool('present', { experience: question, sourceIds: [] }));
  await h.engine.load(); await h.engine.command({ action: 'enable' }); const s = h.engine.session('work');
  s.model = { providerID: 'p', modelID: 'm' }; s.moment = { ...question, id: 'original', assistance: [], snapshot: [] };
  await assert.rejects(h.engine.command({ action: 'submit', sessionID: 'work', value: 'yes' }), /unavailable|budget/);
  assert.equal(s.moment.id, 'original'); assert.equal(s.evidence.length, 0); assert.equal(s.phase, 'ready');
});
test('interrupted tool context is saved locally, hidden from the surface and never replayed automatically after restart', async () => {
  let count = 0;
  const h = fixture(async () => { if (!count++) return tool('retrieve_learner', {}); throw new Error('Provider disconnected'); });
  await h.engine.load(); await h.engine.command({ action: 'enable' }); h.engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await assert.rejects(h.engine.command({ action: 'suggest', sessionID: 'work' }), /disconnected/);
  const run = h.engine.session('work').agentRun;
  assert.equal(run.status, 'interrupted'); assert.equal(run.results[0].tool, 'retrieve_learner');
  const restarted = new LearningEngine({ storage: h.storage, gateway: h.gateway, capabilities: h.engine.capabilities });
  await restarted.load(); assert.equal(restarted.state.enabled, false); assert.equal(count, 2);
  assert.equal(restarted.session('work').agentRun.status, 'interrupted'); assert.equal('agentRun' in restarted.snapshot('work').session, false);
});
for (const rich of [true, false]) test(`agent chooses a real mind-map tool and preserves a ${rich ? 'GUI' : 'text-only'} experience without assessment evidence`, async () => {
  const map = { title: 'Retry conditions', root: { label: 'Failure', children: [{ label: 'Temporary', children: [{ label: 'May clear between requests' }] }, { label: 'Authentication', children: [{ label: 'Needs changed credentials' }] }] } };
  const h = fixture(async ({ prompt, role }) => {
    if (role === 'content-builder') return JSON.stringify(map);
    if (prompt.includes('LEARNING INTENT: goals')) return tool('suggest_goals', { goals: [goal] });
    if (!prompt.includes('"tool":"retrieve_work","result"')) return tool('retrieve_work', { ids: ['source'] });
    if (!prompt.includes('"artifactId":"artifact_1"')) return tool('create_mind_map', { brief: 'Contrast temporary failures with failures needing changed credentials' });
    assert.match(prompt, /May clear between requests/);
    return tool('present', { experience: { ...question, kind: 'mind_map', question: '', rubric: '', body: 'Compare what can change between otherwise identical requests.' }, artifactId: 'artifact_1', sourceIds: ['source'] });
  });
  h.engine.capabilities.surface = { experiments: rich, mindMaps: rich };
  await h.engine.load(); await h.engine.command({ action: 'enable' });
  const s = h.engine.session('work'); s.model = { providerID: 'p', modelID: 'm' }; s.trace = [{ id: 'source', type: 'tool.succeeded', data: { content: 'A 503 retry can recover; 401 needs new credentials' } }];
  await h.engine.command({ action: 'suggest', sessionID: 'work' });
  const snap = await h.engine.command({ action: 'select-goal', sessionID: 'work', value: 0 });
  assert.deepEqual(snap.session.agentTrace.map(x => x.tool), ['retrieve_work', 'create_mind_map', 'present']);
  assert.equal(snap.session.moment.kind, 'mind_map'); assert.equal(snap.session.moment.mindMap.root.label, 'Failure');
  assert.match(snap.session.moment.mindMapText, /  Temporary\n    May clear between requests/); assert.equal(snap.session.evidence.length, 0);
  await h.engine.command({ action: 'dismiss', sessionID: 'work' }); assert.equal(h.engine.state.history[0].mindMap.root.label, 'Failure');
});
test('Ask can choose a mind-map tool as help without replacing the pending question or draft', async () => {
  const map = { title: 'Failure categories', root: { label: 'What must change?', children: [{ label: 'Service conditions' }, { label: 'Caller input' }] } };
  const h = fixture(async ({ prompt, role }) => {
    if (role === 'content-builder') return JSON.stringify(map);
    if (prompt.includes('LEARNING INTENT: goals')) return tool('suggest_goals', { goals: [goal] });
    if (prompt.includes('LEARNING INTENT: moment')) return tool('present', { experience: question, sourceIds: [] });
    return prompt.includes('"artifactId":"artifact_1"') ? tool('answer_question', { answer: 'Use the branches to compare what can change.', artifactId: 'artifact_1' }) : tool('create_mind_map', { brief: 'Show the categories without giving the pending prediction outcome' });
  });
  await h.engine.load(); await h.engine.command({ action: 'enable' }); h.engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await h.engine.command({ action: 'suggest', sessionID: 'work' }); await h.engine.command({ action: 'select-goal', sessionID: 'work', value: 0 });
  const id = h.engine.session('work').moment.id;
  await h.engine.command({ action: 'save-draft', sessionID: 'work', value: { momentId: id, answer: 'I think', choice: '' } });
  const snap = await h.engine.command({ action: 'ask', sessionID: 'work', value: 'Can you show how these categories connect?' });
  assert.equal(snap.session.moment.id, id); assert.equal(snap.session.draft.answer, 'I think');
  assert.equal(snap.session.askAnswer.mindMap.root.label, 'What must change?'); assert.equal(snap.session.evidence.length, 0);
  assert.equal(snap.session.moment.assistance[0].kind, 'ask');
  assert.deepEqual(snap.session.agentTrace.map(x => x.tool), ['create_mind_map', 'answer_question']);
});
test('pausing during a tool builder discards its late result and preserves existing learning state', async () => {
  let finish; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const h = fixture(async ({ prompt, role }) => {
    if (prompt.includes('LEARNING INTENT: goals')) return tool('suggest_goals', { goals: [goal] });
    if (role === 'content-builder') { entered(); return new Promise(resolve => { finish = () => resolve(JSON.stringify({ title: 'Late map', root: { label: 'Late result' } })); }); }
    return tool('create_mind_map', { brief: 'Show the relationships' });
  });
  await h.engine.load(); await h.engine.command({ action: 'enable' }); h.engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await h.engine.command({ action: 'suggest', sessionID: 'work' });
  const pending = h.engine.command({ action: 'select-goal', sessionID: 'work', value: 0 }); await started;
  await h.engine.command({ action: 'pause', sessionID: 'work' }); finish();
  await assert.rejects(pending, /Stale|stopped|paused/);
  assert.equal(h.engine.session('work').moment, null); assert.equal(h.engine.session('work').evidence.length, 0); assert.equal(h.engine.session('work').agentRun.status, 'interrupted');
});
test('a question presented with a mind map records exposure and cannot count as unassisted practice', async () => {
  const h = fixture(async ({ prompt, role }) => {
    if (role === 'content-builder') return JSON.stringify({ title: 'Conditions', root: { label: 'A condition can change' } });
    if (prompt.includes('LEARNING INTENT: goals')) return tool('suggest_goals', { goals: [goal] });
    if (prompt.includes('LEARNING INTENT: assessment')) return tool('assess_answer', { verdict: 'correct', feedback: 'The condition can change.', next: 'Try a fresh case later.' });
    return prompt.includes('"artifactId":"artifact_1"') ? tool('present', { experience: { ...question, kind: 'mind_map' }, sourceIds: [], artifactId: 'artifact_1' }) : tool('create_mind_map', { brief: 'Show the changing condition' });
  });
  await h.engine.load(); await h.engine.command({ action: 'enable' }); h.engine.session('work').model = { providerID: 'p', modelID: 'm' };
  await h.engine.command({ action: 'suggest', sessionID: 'work' }); await h.engine.command({ action: 'select-goal', sessionID: 'work', value: 0 });
  const snap = await h.engine.command({ action: 'submit', sessionID: 'work', value: 'The condition can change.' });
  assert.equal(snap.session.evidence[0].evidenceLabel, 'practiced_with_assistance');
  assert.ok(snap.session.evidence[0].assistance.some(event => event.kind === 'exposure'));
});
