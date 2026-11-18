import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkSelection, observeWork, selectedWork, workUpdate, consumeWork, hasWorkUpdate, workBrief } from '../../learning/src/work-selection.js';
const event = (id, type, data = {}) => ({ id, type, sessionId: 'work', data });
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
test('early task/reasoning sample is followed by observed evidence, never token deltas', () => {
  const state = createWorkSelection();
  assert.equal(observeWork(state, event('task', 'task.submitted', { text: 'Add safe retries' })), true);
  assert.equal(observeWork(state, event('r1', 'reasoning.ended', { text: 'Investigate transient failures' })), true);
  consumeWork(state, state.sequence);
  for (let i=0;i<200;i++) {
    assert.equal(observeWork(state, event(`d${i}`, 'assistant.delta', { text: 'PRIVATE_STREAM' })), false);
    assert.equal(observeWork(state, event(`r${i+2}`, 'reasoning.ended', { text: 'More speculative thinking' })), false);
  }
  assert.equal(hasWorkUpdate(state), false);
  assert.equal(observeWork(state, event('file', 'file.changed', { path: 'retry.js', diff: '+ retry only 503' })), true);
  const packet = workUpdate(state);
  assert.match(JSON.stringify(packet), /retry only 503/);
  assert.doesNotMatch(JSON.stringify(packet), /PRIVATE_STREAM|speculative/);
  assert.equal(packet.context.task, 'Add safe retries');
});
test('deduplication ignores host IDs and prevents repeated output/status from triggering inference', () => {
  const state = createWorkSelection();
  const data = { name: 'test', output: 'Expected 503; actual 401. Failed 1 test' };
  assert.equal(observeWork(state, event('a', 'tool.failed', data)), true);
  consumeWork(state, state.sequence);
  assert.equal(observeWork(state, event('b', 'tool.failed', data)), false);
  assert.equal(observeWork(state, event('status', 'assistant.ended', { text: 'Still working…' })), false);
  assert.equal(hasWorkUpdate(state), false);
});
test('failures and file changes survive a flood of lower-priority completions within actual UTF8 byte bounds', () => {
  const state = createWorkSelection();
  observeWork(state, event('fail', 'tool.failed', { name: 'test', output: 'Expected a bounded retry; got an infinite loop' }));
  observeWork(state, event('diff', 'file.changed', { path: 'retry.js', diff: '+ limit attempts to 3' }));
  for (let i=0;i<100;i++) observeWork(state, event(`o${i}`, 'assistant.ended', { text: `Progress ${i}: ` + '漢'.repeat(10000) }));
  const selected = selectedWork(state);
  assert.ok(selected.some(e => e.id === 'fail')); assert.ok(selected.some(e => e.id === 'diff'));
  assert.ok(size(selected) <= 10000); assert.ok(size(workUpdate(state)) <= 4500);
  assert.ok(size(workBrief(selected)) <= 2200);
  assert.ok(state.entries.length <= 12);
});
test('consumed updates persist, carry only new evidence, and a new task resets task-specific context', () => {
  let state = createWorkSelection();
  observeWork(state, event('task', 'task.submitted', { text: 'Old task' }));
  observeWork(state, event('old', 'file.changed', { path: 'old.js', diff: '+ old decision' }));
  consumeWork(state, state.sequence); state = JSON.parse(JSON.stringify(state));
  assert.equal(hasWorkUpdate(state), false);
  observeWork(state, event('new', 'tool.succeeded', { path: 'new.js', content: 'new mechanism' }));
  assert.deepEqual(workUpdate(state).changes.map(e => e.id), ['new']);
  observeWork(state, event('task2', 'task.submitted', { text: 'New task' }));
  assert.doesNotMatch(JSON.stringify(selectedWork(state)), /old decision|Old task/);
  assert.equal(state.reasoningSampled, false);
});
test('tool results retain captured input paths without treating proposed content as completed output', () => {
  const state = createWorkSelection();
  observeWork(state, event('call', 'tool.started', { id: 't1', name: 'read', input: { filePath: 'retry.js' } }));
  observeWork(state, event('done', 'tool.succeeded', { id: 't1', output: [{ type: 'text', text: 'function shouldRetry() {}' }] }));
  const source = selectedWork(state).find(e => e.id === 'done');
  assert.equal(source.data.input.filePath, 'retry.js');
  assert.match(JSON.stringify(source), /shouldRetry/);
});
test('sensitive tool inputs and their results never enter the evidence bank', () => {
  const state = createWorkSelection();
  observeWork(state, event('call', 'tool.started', { id: 'secret-tool', input: { filePath: '.env', content: 'PRIVATE_CONFIG' } }));
  observeWork(state, event('result', 'tool.succeeded', { id: 'secret-tool', output: 'PRIVATE_CONFIG' }));
  assert.doesNotMatch(JSON.stringify(state), /PRIVATE_CONFIG/);
  assert.deepEqual(selectedWork(state), []);
});
test('one noisy category cannot fill the bank and exclude a later file change', () => {
  const state = createWorkSelection();
  for (let i=0;i<20;i++) observeWork(state, event(`fail${i}`, 'tool.failed', { error: `failure ${i}` }));
  assert.equal(observeWork(state, event('change', 'file.changed', { path: 'retry.js', diff: '+ bounded attempts' })), true);
  assert.ok(selectedWork(state).some(e => e.id === 'change'));
});
test('a new task may reuse identical evidence without inheriting the prior task bank', () => {
  const state = createWorkSelection(); const data = { path: 'retry.js', content: 'same code, new task' };
  observeWork(state, event('task1', 'task.submitted', { text: 'Add retries' }));
  observeWork(state, event('read1', 'tool.succeeded', data)); consumeWork(state, state.sequence);
  observeWork(state, event('task2', 'task.submitted', { text: 'Explain retries' }));
  assert.equal(observeWork(state, event('read2', 'tool.succeeded', data)), true);
  assert.deepEqual(selectedWork(state).map(e => e.id), ['task2', 'read2']);
});

test('brief steering retains bounded recent work without treating it as a fresh change',()=>{
 const state=createWorkSelection();
 observeWork(state,{id:'t1',type:'task.submitted',data:{text:'Build a portable local learner memory store'}});
 observeWork(state,{id:'f',type:'file.changed',data:{path:'learner-store.js',content:'+ atomic rename around merged attempts'}});
 observeWork(state,{id:'t2',type:'task.submitted',data:{text:'Code actually'}});
 const packet=workUpdate(state);
 assert.match(JSON.stringify(packet.context.previousWork),/learner-store|atomic rename/);
 assert.equal(packet.changes.length,0);assert.equal(state.entries.length,0);
 for(let i=0;i<20;i++)observeWork(state,{id:'next'+i,type:'task.submitted',data:{text:'A brief follow-up '+i}});
 assert.ok(Buffer.byteLength(JSON.stringify(state.recentContext))<=1800);
});
test('host shell commands expose meaningful build and test evidence immediately',()=>{
 const state=createWorkSelection();observeWork(state,{id:'test',type:'tool.succeeded',data:{tool:'command',command:'npm run build:codex',output:'Built successfully'}});
 assert.equal(state.entries[0].priority,85);
});

test('read-only command chatter and empty search failures do not become model evidence',()=>{
 const s=createWorkSelection();
 for(let n=0;n<30;n++)assert.equal(observeWork(s,event('ls'+n,'tool.succeeded',{tool:'command',command:'ls src',output:'index.ts helpers.ts'})),false);
 assert.equal(observeWork(s,event('search','tool.failed',{tool:'command',command:'rg missing-symbol src',output:'',exitCode:1})),false);
 assert.equal(s.entries.length,0);
 assert.equal(observeWork(s,event('test','tool.succeeded',{tool:'command',command:'npm test',output:'3 tests passed',exitCode:0})),true);
 assert.equal(s.entries[0].priority,85);
});
