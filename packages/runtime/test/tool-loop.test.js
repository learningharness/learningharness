import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../src/tool-registry.js';
import { runToolLoop } from '../src/tool-loop.js';

const call = (tool, input = {}) => JSON.stringify({ tool, input, reason: 'Useful for the current learner' });
test('new tools register without loop changes and their executed results drive the next choice', async () => {
  const registry = new ToolRegistry(); const checkpoints = []; let count = 0;
  registry.register({ name: 'map_relationships', description: 'Show dependencies', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: async () => ({ relationship: 'client depends on retry policy' }) });
  registry.register({ name: 'publish', description: 'Publish once', terminal: true, inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 100 } }, required: ['text'], additionalProperties: false }, execute: async input => input.text });
  const result = await runToolLoop({ registry, prompt: 'Teach relationships', onCheckpoint: async state => checkpoints.push(structuredClone(state)), request: async prompt => {
    if (!count++) return call('map_relationships');
    assert.match(prompt, /client depends on retry policy/); assert.match(prompt, /inputSchema/);
    return call('publish', { text: 'A dependency map' });
  } });
  assert.equal(result.value, 'A dependency map'); assert.equal(count, 2);
  assert.deepEqual(result.trace.map(t => t.tool), ['map_relationships', 'publish']);
  assert.equal(checkpoints.at(-1).status, 'completed');
});
test('schemas and capability availability prevent dispatch; errors return to the agent for repair', async () => {
  const registry = new ToolRegistry(); let executed = 0; let index = 0;
  registry.register({ name: 'hidden', description: 'Unavailable', available: false, execute: () => { throw new Error('must not run'); }, inputSchema: { type: 'object' } });
  registry.register({ name: 'publish', description: 'Publish', terminal: true, inputSchema: { type: 'object', properties: { answer: { type: 'string', maxLength: 10 } }, required: ['answer'], additionalProperties: false }, execute: input => { executed++; return input.answer; } });
  const responses = [call('hidden'), call('publish', { answer: 'x', private: true }), call('publish', { answer: 'ok' })];
  const result = await runToolLoop({ registry, prompt: 'Choose', request: async prompt => { if (index === 1) assert.match(prompt, /Unknown or unavailable/); return responses[index++]; } });
  assert.equal(result.value, 'ok'); assert.equal(executed, 1); assert.equal(registry.describe().some(t => t.name === 'hidden'), false);
});
test('builder requests share the execution budget, and stop prevents result publication', async () => {
  const registry = new ToolRegistry(); let stopped = false; let count = 0;
  registry.register({ name: 'build', description: 'Build', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: async (_, api) => api.request('worker', 'content-builder') });
  await assert.rejects(runToolLoop({ registry, prompt: 'Choose', maxRequests: 2, request: async (_, role) => { count++; return role === 'content-builder' ? '{}' : call('build'); } }), /budget exhausted/);
  assert.equal(count, 2);
  await assert.rejects(runToolLoop({ registry, prompt: 'Choose', check: () => { if (stopped) throw new Error('stopped'); }, request: async () => { stopped = true; return call('build'); } }), /stopped/);
});
test('bare prose/content never bypasses tool validation, and oversized results cannot enter context', async () => {
  const registry = new ToolRegistry(); registry.register({ name: 'large', description: 'Too large', inputSchema: { type: 'object' }, execute: () => 'x'.repeat(50000) });
  for (const output of ['{"decision":"offer","body":"bare content"}', call('large')]) {
    await assert.rejects(runToolLoop({ registry, prompt: 'Choose', maxRequests: 2, request: async () => output }), /budget exhausted/);
  }
});
test('unsupported schema keywords fail at registration instead of being silently ignored', () => {
  const registry = new ToolRegistry();
  assert.throws(() => registry.register({ name: 'unsafe_schema', description: 'Needs a real pattern check', inputSchema: { type: 'string', pattern: '^safe$' }, execute: value => value }), /Unsupported/);
});

test('output-limit repair consumes the original request budget and never retries other provider errors', async () => {
  const registry = new ToolRegistry(); let published = 0;
  registry.register({ name: 'publish', description: 'Publish', terminal: true, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute: () => { published++; return 'ready'; } });
  let calls = 0;
  const limited = () => Object.assign(new Error('Learning answer exceeded output bounds; return one concise tool call'), { code: 'LEARNING_OUTPUT_LIMIT' });
  const result = await runToolLoop({ registry, prompt: 'Teach', maxRequests: 2, request: async prompt => {
    if (!calls++) throw limited();
    assert.match(prompt, /exceeded output bounds/);
    return call('publish');
  } });
  assert.equal(result.value, 'ready'); assert.equal(calls, 2); assert.equal(published, 1);
  calls = 0;
  await assert.rejects(runToolLoop({ registry, prompt: 'Teach', maxRequests: 1, request: async () => { calls++; throw limited(); } }), /budget exhausted/);
  assert.equal(calls, 1); assert.equal(published, 1);
  calls = 0;
  await assert.rejects(runToolLoop({ registry, prompt: 'Teach', request: async () => { calls++; throw Error('Provider unavailable'); } }), /Provider unavailable/);
  assert.equal(calls, 1);
});
