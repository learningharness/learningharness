import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { ToolRegistry } from '../src/tool-registry.js';
import { runPiCycle } from '../src/pi-runner.js';
import { runAgentCycle } from '../src/agent-cycle.js';

const model = { id: 'fixture', name: 'fixture', api: 'openai-responses', provider: 'fixture', baseUrl: '', input: ['text'], reasoning: false, contextWindow: 10000, maxTokens: 1000, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const usage = { input: 12, output: 3, cacheRead: 2, cacheWrite: 0, totalTokens: 17, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function port(responses, contexts = []) {
  return { kind: 'model-stream', streamFn: (_model, context, options) => {
    contexts.push(structuredClone(context));
    const stream = new AssistantMessageEventStream();
    queueMicrotask(async () => {
      const next = responses.shift();
      const content = typeof next === 'function' ? await next(options.signal) : next;
      const message = { role: 'assistant', content, api: model.api, provider: model.provider, model: model.id, usage, stopReason: content.some(c => c.type === 'toolCall') ? 'toolUse' : 'stop', timestamp: Date.now() };
      stream.push({ type: 'start', partial: message });
      stream.push({ type: 'text_delta', contentIndex: 0, delta: 'streamed', partial: message });
      stream.push({ type: 'done', reason: message.stopReason, message });
    });
    return stream;
  } };
}
const call = (name, args = {}, id = name) => ({ type: 'toolCall', id, name, arguments: args });
function registry(onTerminal = () => {}) {
  return new ToolRegistry()
    .register({ name: 'retrieve_work', description: 'Frozen evidence', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: async () => ({ source: 'frozen', value: 42 }) })
    .register({ name: 'present', terminal: true, description: 'Propose one result', inputSchema: { type: 'object', properties: { answer: { type: 'string', minLength: 1 } }, required: ['answer'], additionalProperties: false }, execute: async input => { onTerminal(); return input; } });
}
test('Pi executes the registry, streams deltas, inspects real results and yields without another request', async () => {
  const contexts = [], states = [], events = [];
  const result = await runPiCycle({ registry: registry(), model, port: port([[call('retrieve_work')], [call('present', { answer: '42' })]], contexts), prompt: 'Teach', onEvent: e => events.push(e), onCheckpoint: async s => states.push(s) });
  assert.deepEqual(result.value, { answer: '42' });
  assert.equal(contexts.length, 2);
  assert.match(JSON.stringify(contexts[1].messages.filter(m => m.role === 'toolResult')), /frozen/);
  assert.deepEqual(result.trace.map(t => t.tool), ['retrieve_work', 'present']);
  assert.equal(states.at(-1).status, 'completed');
  assert.equal(states.at(-1).usage.length, 2);
  assert.equal(states.at(-1).usage[0].input, 12);
  assert.ok(events.some(e => e.type === 'text_delta'));
});
test('whole-agent ports fail closed before dispatch', async () => {
  await assert.rejects(runPiCycle({ registry: registry(), model, port: { kind: 'agent-turn', streamFn: () => assert.fail('must not dispatch') }, prompt: 'Teach' }), /model-stream/);
});
test('unknown tools and invalid arguments cannot execute terminal actions; bounded repair retains errors', async () => {
  let terminals = 0;
  const contexts = [];
  const result = await runPiCycle({ registry: registry(() => terminals++), model, port: port([[call('unknown')], [call('present', { answer: 42 })], [call('present', { answer: 'Valid' })]], contexts), prompt: 'Teach', maxRequests: 3, maxValidationErrors: 3 });
  assert.equal(terminals, 1);
  assert.equal(contexts[2].messages.filter(m => m.role === 'toolResult' && m.isError).length, 2);
  assert.equal(result.value.answer, 'Valid');
});
test('request budget is checked before a follow-up and interrupted journal retains usage', async () => {
  const states = [];
  await assert.rejects(runPiCycle({ registry: registry(), model, port: port([[call('retrieve_work')]]), prompt: 'Teach', maxRequests: 1, onCheckpoint: async s => states.push(s) }), /budget exhausted/);
  assert.equal(states.at(-1).status, 'interrupted');
  assert.equal(states.at(-1).usage.length, 1);
});
test('abort during model response rejects late terminal actions and retains settled usage', async () => {
  const controller = new AbortController(); let terminals = 0; const states = [];
  await assert.rejects(runPiCycle({ registry: registry(() => terminals++), model, port: port([async () => { controller.abort(); return [call('present', { answer: 'Late' })]; }]), signal: controller.signal, prompt: 'Teach', onCheckpoint: async s => states.push(s) }), /cancel/i);
  assert.equal(terminals, 0);
  assert.equal(states.at(-1).status, 'interrupted');
  assert.equal(states.at(-1).usage.length, 1);
});
test('a terminal call prevents duplicate actions in the same tool batch', async () => {
  let terminals = 0;
  const result = await runPiCycle({ registry: registry(() => terminals++), model, port: port([[call('present', { answer: 'One' }, 'a'), call('present', { answer: 'Two' }, 'b')]]), prompt: 'Teach' });
  assert.equal(terminals, 1); assert.equal(result.value.answer, 'One');
});
test('Pi plugs into the existing intent and learning-tool validators without publishing evidence', async () => {
  const result = await runAgentCycle({ intent: 'ask', prompt: 'Explain atomic replacement', work: [], learner: [],
    execute: options => runPiCycle({ ...options, model, port: port([[call('answer_question', { answer: 'Readers see a complete old or new file.' })]]) }) });
  assert.match(result.answer, /complete old or new/); assert.equal(result.trace[0].tool, 'answer_question');
});
test('journal failure after a terminal tool cannot be mistaken for a successful proposal', async () => {
  const states = [];
  await assert.rejects(runPiCycle({ registry: registry(), model, port: port([[call('present', { answer: 'Valid' })]]), prompt: 'Teach',
    onCheckpoint: async state => { states.push(state); if (state.status === 'running' && state.results.length) throw Error('Journal unavailable'); } }), /Journal unavailable/);
  assert.equal(states.at(-1).status, 'interrupted');
});
test('content builders consume the same request budget as Pi orchestration', async () => {
  const tools = registry().register({ name: 'build', description: 'Draft', inputSchema: { type: 'object' }, execute: async (_, api) => api.request('draft', 'content-builder') });
  let builders = 0; const states = [];
  await assert.rejects(runPiCycle({ registry: tools, model, port: port([[call('build')]]), request: async () => { builders++; return 'draft'; }, maxRequests: 1, prompt: 'Teach', onCheckpoint: async s => states.push(s) }), /budget exhausted/);
  assert.equal(builders, 0); assert.equal(states.at(-1).remaining, 0);
});
test('registry normalization runs before Pi validation without changing raw input', async () => {
  const original = { answer: 'Valid', discard: true };
  const tools = new ToolRegistry().register({ name: 'finish', terminal: true, description: 'Normalize', inputSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false }, normalizeInput: input => { delete input.discard; return input; }, execute: input => input });
  const result = await runPiCycle({ registry: tools, model, port: port([[call('finish', original)]]), prompt: 'Teach' });
  assert.deepEqual(result.value, { answer: 'Valid' }); assert.equal(original.discard, true);
});
test('transport failure records unknown usage and interrupts without a proposal', async () => {
  const states = [];
  await assert.rejects(runPiCycle({ registry: registry(), model, port: { kind: 'model-stream', streamFn: () => { throw Error('Disconnected'); } }, prompt: 'Teach', onCheckpoint: async s => states.push(s) }), /Disconnected/);
  assert.equal(states.at(-1).status, 'interrupted'); assert.deepEqual(states.at(-1).usage, [null]);
});
test('an explicitly injected executor also owns the interactive Ask path', async () => {
  let executed = false;
  const spec = { title: 'Two updates', controls: [], outputs: [], experiments: [] };
  const result = await runAgentCycle({ intent: 'ask', prompt: 'Show updates', requireInteractive: true, interactiveBrief: 'Two writers', work: [], learner: [], build: async () => spec,
    execute: options => { executed = true; return runPiCycle({ ...options, model, port: port([[call('build_interactive', { brief: 'Two writers' })], [call('answer_question', { answer: 'Explore both orders.', artifactId: 'artifact_1' })]]) }); } });
  assert.equal(executed, true); assert.deepEqual(result.experiment, spec);
});
