import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {claimStartup,readStartup,dismissStartup,startupSignal,markStartupShown,claimStartupView} from '../desktop-runtime/startup-invitation.mjs';
const id='12345678-1234-1234-1234-123456789abc',other='22345678-1234-1234-1234-123456789abc';
test('startup invitation persists dismissal without touching global mode or another chat',async()=>{const dir=await mkdtemp(join(tmpdir(),'lh-startup-'));try{
 await writeFile(join(dir,'state.json'),JSON.stringify({on:false,setup:{completedAt:1}}));
 const event={session_id:id,hook_event_name:'SessionStart',source:'startup'};
 assert.ok(claimStartup(dir,event));assert.equal(claimStartup(dir,event),null);assert.equal(readStartup(dir,id).on,false);
 dismissStartup(dir,id);await writeFile(join(dir,'state.json'),JSON.stringify({on:true,setup:{completedAt:1}}));
 assert.equal(readStartup(dir,id).dismissed,true);assert.equal(claimStartup(dir,{...event,source:'resume'}),null);
 assert.ok(claimStartup(dir,{...event,session_id:other}));assert.equal(readStartup(dir,other).on,true);
 assert.equal(JSON.parse(await readFile(join(dir,'state.json'),'utf8')).on,true);assert.throws(()=>readStartup(dir,'../bad'));
 for(const source of ['compact','fork','clear'])assert.equal(claimStartup(dir,{...event,source,session_id:'32345678-1234-1234-1234-123456789abc'}),null);
 }finally{await rm(dir,{recursive:true,force:true});}});
test('Off hook signals startup once but never observes work; compaction stays silent',async()=>{const dir=await mkdtemp(join(tmpdir(),'lh-startup-hook-'));try{
 await writeFile(join(dir,'state.json'),JSON.stringify({on:false}));const run=event=>spawnSync(process.execPath,[resolve('scripts/desktop-runtime/chain-hook.mjs')],{env:{...process.env,LEARNING_HARNESS_DATA_DIR:dir},input:JSON.stringify(event),encoding:'utf8'});
 const event={session_id:id,hook_event_name:'SessionStart',source:'startup'};const out=run(event);assert.equal(out.status,0);assert.equal(JSON.parse(out.stdout).hookSpecificOutput.additionalContext,startupSignal);
 assert.equal(run({...event,hook_event_name:'UserPromptSubmit'}).stdout,'');assert.equal(run({...event,source:'compact',session_id:other}).stdout,'');
 await assert.rejects(readFile(join(dir,'watch-'+id+'.json')),e=>e.code==='ENOENT');
 }finally{await rm(dir,{recursive:true,force:true});}});
test('On is immediate text only; activity and ordinary resume never reissue; verified app relaunch may remind Off',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-startup-return-'));
 try{
  const event={session_id:id,hook_event_name:'SessionStart',source:'startup'},first={id:'a'.repeat(64),startedAt:0},second={id:'b'.repeat(64),startedAt:Date.now()+1000};
  await writeFile(join(dir,'state.json'),JSON.stringify({on:true}));
  const result=claimStartup(dir,event,{launch:first});assert.deepEqual(Object.keys(result),['systemMessage']);assert.match(result.systemMessage,/is On/);
  assert.equal(claimStartup(dir,{...event,source:'resume'},{launch:first}),null);
  await writeFile(join(dir,'state.json'),JSON.stringify({on:false}));
  assert.equal(claimStartup(dir,{...event,hook_event_name:'UserPromptSubmit'},{launch:first}),null);
  assert.equal(claimStartup(dir,{...event,source:'resume'},{launch:null}),null);
  assert.ok(claimStartup(dir,{...event,source:'resume'},{launch:second}).hookSpecificOutput);
  dismissStartup(dir,id);
  assert.equal(claimStartup(dir,event,{launch:{id:'c'.repeat(64),startedAt:Date.now()+2000}}),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('repeated launcher calls and remounted Off widgets cannot show another startup card',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-startup-views-'));
 try{await writeFile(join(dir,'state.json'),JSON.stringify({on:false}));claimStartup(dir,{session_id:id,hook_event_name:'SessionStart',source:'startup'},{launch:null});
 assert.equal(markStartupShown(dir,id),true);assert.equal(markStartupShown(dir,id),false);
 assert.equal(claimStartupView(dir,id).dismissed,false);assert.equal(claimStartupView(dir,id).dismissed,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
