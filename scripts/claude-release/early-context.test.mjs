import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtemp,writeFile,readdir,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const id='12345678-1234-4234-8234-123456789abc';
test('an On first-turn prompt is captured before writes, including launcher fallback; Off stays private',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-early-context-'));t.after(()=>rm(dir,{recursive:true,force:true}));const env={...process.env,LEARNING_HARNESS_DATA_DIR:dir};
 const send=event=>{const r=spawnSync(process.execPath,[resolve('scripts/claude-release/hook.mjs')],{env,input:JSON.stringify({session_id:id,cwd:'/synthetic/project',...event}),encoding:'utf8'});assert.equal(r.status,0);return r.stdout;};
 await writeFile(join(dir,'state.json'),JSON.stringify({on:false}));send({hook_event_name:'UserPromptSubmit',prompt:'PRIVATE_OFF_TASK'});await assert.rejects(readdir(join(dir,'events')),{code:'ENOENT'});
 await writeFile(join(dir,'state.json'),JSON.stringify({on:true}));send({hook_event_name:'UserPromptSubmit',prompt:'Build an HTTP response cache with invalidation after successful writes'});
 const folders=await readdir(join(dir,'events'));const files=await readdir(join(dir,'events',folders[0]));const record=JSON.parse(await readFile(join(dir,'events',folders[0],files[0]),'utf8'));
 assert.deepEqual(record.events.map(e=>e.type),['task.submitted']);assert.match(record.events[0].data.text,/HTTP response cache/);assert(!JSON.stringify(record).includes('PRIVATE_OFF_TASK'));
 send({hook_event_name:'PostToolUse',tool_name:'AskUserQuestion',tool_use_id:'answer',tool_response:{answers:{'Which cache?':'An HTTP response cache with TTL'}}});
 const records=await Promise.all((await readdir(join(dir,'events',folders[0]))).map(async f=>JSON.parse(await readFile(join(dir,'events',folders[0],f),'utf8'))));
 assert(records.some(r=>r.events.some(e=>e.type==='task.submitted'&&/TTL/.test(e.data.text))));assert(!records.some(r=>r.events.some(e=>e.type==='file.changed')));
});

test('the Learn command and its acknowledgement never replace coding evidence',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-ui-turn-'));t.after(()=>rm(dir,{recursive:true,force:true}));const env={...process.env,LEARNING_HARNESS_DATA_DIR:dir};
 const send=event=>spawnSync(process.execPath,[resolve('scripts/claude-release/hook.mjs')],{env,input:JSON.stringify({session_id:id,cwd:'/synthetic/project',...event}),encoding:'utf8'});
 await writeFile(join(dir,'state.json'),JSON.stringify({on:true}));send({hook_event_name:'UserPromptSubmit',prompt:'Implement cache ownership guards'});
 send({hook_event_name:'UserPromptSubmit',prompt:'/learningharness:learn'});send({hook_event_name:'Stop',last_assistant_message:'I opened LearningHarness.'});
 const folder=join(dir,'events',(await readdir(join(dir,'events')))[0]);let records=await Promise.all((await readdir(folder)).map(async f=>JSON.parse(await readFile(join(folder,f),'utf8'))));assert.equal(records.length,1);assert.equal(records[0].events[0].data.text,'Implement cache ownership guards');
 send({hook_event_name:'UserPromptSubmit',prompt:'Add a rejection race test'});send({hook_event_name:'Stop',last_assistant_message:'The rejection test passes.'});records=await Promise.all((await readdir(folder)).map(async f=>JSON.parse(await readFile(join(folder,f),'utf8'))));assert.equal(records.length,3);
});
