import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CodexRpc } from '../src/rpc.js';

function connection() {
  const child = new EventEmitter(), sent = [];
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = { write: text => sent.push(JSON.parse(text)) }; child.kill = () => {};
  return { rpc: new CodexRpc(child), sent, receive: value => child.stdout.write(JSON.stringify(value) + '\n') };
}
const params = { threadId: 'owned', turnId: 'turn', callId: 'call', tool: 'retrieve_work', arguments: {} };
test('only explicitly bound learning tools can answer server requests; approvals and other threads fail closed', async () => {
  const { rpc, sent, receive } = connection(); let calls = 0;
  rpc.bindLearningTools('owned', ['retrieve_work'], async () => { calls++; return { success: true, contentItems: [{ type: 'inputText', text: 'frozen evidence' }] }; });
  receive({ id: 1, method: 'item/tool/call', params });
  receive({ id: 2, method: 'item/tool/call', params: { ...params, threadId: 'coding' } });
  receive({ id: 3, method: 'item/tool/call', params: { ...params, tool: 'shell' } });
  receive({ id: 4, method: 'item/commandExecution/requestApproval', params });
  receive({ id: 5, method: 'item/tool/call', params: { ...params, namespace: 'coding' } });
  await new Promise(setImmediate);
  assert.equal(calls, 1); assert.equal(sent.find(s => s.id === 1).result.success, true);
  for (const id of [2, 3, 4, 5]) assert.equal(sent.find(s => s.id === id).error.code, -32601);
});
test('unbinding an in-flight tool discards its late successful response', async () => {
  const { rpc, sent, receive } = connection(); let finish;
  const unbind = rpc.bindLearningTools('owned', ['retrieve_work'], () => new Promise(resolve => { finish = resolve; }));
  receive({ id: 1, method: 'item/tool/call', params });
  await new Promise(setImmediate); unbind();
  finish({ success: true, contentItems: [{ type: 'inputText', text: 'late' }] });
  await new Promise(setImmediate);
  assert.equal(sent.at(-1).error.code, -32601); assert.equal(sent.at(-1).result, undefined);
});
test('dynamic tool exceptions return a fixed error without leaking host or learner content', async () => {
  const { rpc, sent, receive } = connection();
  rpc.bindLearningTools('owned', ['retrieve_work'], async () => { throw Error('PRIVATE_LEARNER'); });
  receive({ id: 1, method: 'item/tool/call', params }); await new Promise(setImmediate);
  assert.equal(sent[0].error.code, -32603); assert.doesNotMatch(JSON.stringify(sent), /PRIVATE_LEARNER/);
});
