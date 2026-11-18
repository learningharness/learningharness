import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLessonWork} from '../src/lesson-work.js';

const task = id => ({id, type: 'task.submitted', data: {text: 'Prevent invalidated HTTP responses from refilling the cache'}});
const fileRead = {id: 'read-cache', type: 'tool.succeeded', data: {name: 'read', path: 'src/cache.js', content: 'if (generation === startedAt) cache.set(key, response);'}};
const fileChange = {id: 'edit-cache', type: 'file.changed', data: {path: 'src/cache.js', diff: '+ if (generation === startedAt) cache.set(key, response);'}};
const testResult = {id: 'cache-tests', type: 'tool.succeeded', data: {name: 'test', command: 'node --test test/cache.test.js', output: 'stale response is delivered but not stored: PASS'}};

test('a lesson prepared after same-task implementation uses the current files, changes and test evidence', () => {
  const frozen = [task('task-cache'), {id: 'early-plan', type: 'assistant.ended', data: {text: 'I will inspect the cache before choosing an approach.'}}];
  const current = [task('task-cache'), fileRead, fileChange, testResult];

  const selected = selectLessonWork(frozen, current);

  assert.deepEqual(selected, current);
  assert.equal(selected.some(event => event.id === 'early-plan'), false, 'replace stale task evidence rather than merging it into current evidence');
});

test('a newer coding task cannot leak its implementation into a selected older lesson', () => {
  const frozen = [task('task-cache'), fileRead];
  const current = [{id: 'task-layout', type: 'task.submitted', data: {text: 'Repair the settings page layout'}},
    {id: 'edit-layout', type: 'file.changed', data: {path: 'src/settings.css', diff: '+ min-width: 0;'}}];

  assert.deepEqual(selectLessonWork(frozen, current), frozen);
});

test('missing task identity in either snapshot retains the frozen evidence', () => {
  for (const [frozen, current] of [
    [[task('task-cache'), fileRead], [fileChange, testResult]],
    [[fileRead], [task('task-cache'), fileChange, testResult]],
    [[fileRead], [fileChange, testResult]],
    [[task('task-cache'), fileRead], []],
  ]) {
    assert.deepEqual(selectLessonWork(frozen, current), frozen);
  }
});

test('task events without a nonempty id cannot establish same-task grounding', () => {
  for (const id of [undefined, null, '', '   ']) {
    const frozen = [task(id), fileRead];
    const current = [task(id), fileChange, testResult];
    assert.deepEqual(selectLessonWork(frozen, current), frozen);
  }
});

test('selected lesson evidence is an independent deep clone on both selection paths', () => {
  for (const sameTask of [true, false]) {
    const frozen = [task('task-cache'), structuredClone(fileRead)];
    const current = [task(sameTask ? 'task-cache' : 'task-new'), structuredClone(fileChange)];
    const beforeFrozen = structuredClone(frozen);
    const beforeCurrent = structuredClone(current);

    const selected = selectLessonWork(frozen, current);
    selected[0].data.text = 'Modified lesson copy';
    selected[1].data.path = 'modified.js';
    selected.push(testResult);

    assert.deepEqual(frozen, beforeFrozen);
    assert.deepEqual(current, beforeCurrent);
  }
});

test('unidentified newer code is not silently treated as fresh frozen work',async()=>{
 const {canSelectLessonWork}=await import('../src/lesson-work.js');
 assert.equal(canSelectLessonWork([fileRead],[fileRead,fileChange]),false);
 assert.equal(canSelectLessonWork([task('task-cache'),fileRead],[fileChange]),false);
 assert.equal(canSelectLessonWork([fileRead],[fileRead]),true);
 assert.equal(canSelectLessonWork([task('task-cache'),fileRead],[]),true,'no new observations do not invalidate a captured snapshot');
 assert.equal(canSelectLessonWork([task('task-cache')],[task('task-new'),fileChange]),true,'an explicitly selected older task can keep its own frozen evidence');
});

test('an explicitly observed new task lets an older file-only topic retain its own frozen code',async()=>{
 const {canSelectLessonWork}=await import('../src/lesson-work.js');const frozen=[fileRead],current=[task('new-task'),fileChange];
 assert.equal(canSelectLessonWork(frozen,current),true);assert.deepEqual(selectLessonWork(frozen,current),frozen);
});


test('a later assistant summary does not invalidate prepared code but new code or tool outcomes do',async()=>{
 const {sameLessonGrounding}=await import('../src/lesson-work.js');
 const frozen=[task('task-cache'),fileRead,testResult];
 assert.equal(sameLessonGrounding(frozen,[...frozen,{id:'final-summary',type:'assistant.ended',data:{text:'All tests pass'}}]),true);
 assert.equal(sameLessonGrounding(frozen,[...frozen,fileChange]),false);
 assert.equal(sameLessonGrounding(frozen,[...frozen,{...testResult,id:'new-tests',data:{output:'FAIL'}}]),false);
 assert.equal(sameLessonGrounding([task('task-cache')],[task('task-cache'),{id:'summary',type:'assistant.ended',data:{text:'Implemented cache'}}]),false,'task-only teaching still refreshes when actual work arrives');
 assert.equal(sameLessonGrounding(frozen,[task('different-task'),fileRead,testResult]),false);
});


test('a final summary cannot evict frozen material when the selector is full',async()=>{
 const {createWorkSelection,observeWork,selectedWork}=await import('../src/work-selection.js');
 const {sameLessonGrounding}=await import('../src/lesson-work.js');const selection=createWorkSelection();observeWork(selection,task('capacity-task'));
 for(let i=0;i<4;i++)observeWork(selection,{id:'f'+i,type:'file.changed',data:{path:'f'+i+'.js',content:'const f'+i+' = 1;'}});
 for(let i=0;i<6;i++)observeWork(selection,{id:'r'+i,type:'tool.succeeded',data:{name:'Read',path:'r'+i+'.js',content:'const r'+i+' = 1;'}});
 for(let i=0;i<2;i++)observeWork(selection,{id:'p'+i,type:'tool.input.ended',data:{name:'Edit',path:'p'+i+'.js',input:{new_string:'pending'+i}}});
 const before=selectedWork(selection);assert.equal(selection.entries.length,12);
 observeWork(selection,{id:'last-summary',type:'assistant.ended',data:{text:'Implementation and tests are complete.'}});
 assert.equal(sameLessonGrounding(before,selectedWork(selection)),true);
 observeWork(selection,{id:'actual-edit',type:'file.changed',data:{path:'changed.js',content:'const changed = true;'}});
 assert.equal(sameLessonGrounding(before,selectedWork(selection)),false);
});


test('metadata-only file paths do not suppress the first meaningful summary at capacity',async()=>{
 const {createWorkSelection,observeWork,selectedWork}=await import('../src/work-selection.js');const selection=createWorkSelection();observeWork(selection,task('metadata-task'));
 for(let i=0;i<4;i++)observeWork(selection,{id:'m'+i,type:'file.changed',data:{path:'m'+i+'.js'}});
 for(let i=0;i<6;i++)observeWork(selection,{id:'r'+i,type:'tool.succeeded',data:{name:'Read',path:'r'+i+'.js'}});
 for(let i=0;i<2;i++)observeWork(selection,{id:'p'+i,type:'tool.input.ended',data:{name:'Edit',path:'p'+i+'.js'}});
 assert.equal(observeWork(selection,{id:'first-summary',type:'assistant.ended',data:{text:'The cache now serializes updates before replacement.'}}),true);
 assert(selectedWork(selection).some(event=>event.id==='first-summary'));
});
