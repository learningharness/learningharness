import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {pendingNudge} from '../src/nudge.js';
const state=()=>({enabled:true,session:{id:'s',workRevision:1,upcomingGoals:{id:'g',createdAt:Date.now(),workRevision:1,list:[{outcome:'Understand local memory',path:['Safe writes','Portability']}]}}});
test('only current real opportunities can draw attention outside a visible panel',()=>{
 assert.match(pendingNudge(state()).message,/local memory/);assert.equal(pendingNudge(state(),{visible:true}),null);
 for(const change of [s=>s.enabled=false,s=>s.session.paused=true,s=>s.session.workRevision=2,s=>s.session.upcomingGoals.list=[],s=>s.session.seenOpportunityIds=['g']]){const s=state();change(s);assert.equal(pendingNudge(s),null);}
});
test('Codex emits one generic readiness signal without lesson, source or learner data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-nudge-'));try{
 await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));
 const run=id=>spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:id,hook_event_name:'PostToolUse',tool_input:{secret:'must not appear'}}),encoding:'utf8'});
 assert.equal(run('other').stdout,'');const first=run('s');assert.equal(first.status,0);const output=JSON.parse(first.stdout);assert.deepEqual(Object.keys(output),['hookSpecificOutput']);assert.equal(output.hookSpecificOutput.hookEventName,'PostToolUse');assert.match(output.hookSpecificOutput.additionalContext,/learning opportunity/);assert.doesNotMatch(first.stdout,/must not appear|local memory|systemMessage/);assert.equal(run('s').stdout,'');
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('stale topic invitations expire instead of being renewed on every poll',()=>{
 const s=state();s.session.upcomingGoals.createdAt=1000;
 assert.equal(pendingNudge(s,{now:121001}),null);
 assert.equal(pendingNudge(s,{now:5000}).expiresAt,121000);
});
test('native notices have a persistent cooldown across different offers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-nudge-cooldown-'));try{
 const run=()=>spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:'s',hook_event_name:'PostToolUse'}),encoding:'utf8'});
 await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));
 assert.ok(run().stdout);const next=state();next.session.upcomingGoals.id='second';
 await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(next)));
 assert.equal(run().stdout,'');
 await writeFile(join(dir,'nudge-claims/last.json'),JSON.stringify({at:Date.now()-300001,id:'g',sessionId:'s'}));
 assert.ok(run().stdout,'A distinct fresh invitation should be eligible after five minutes');
 }finally{await rm(dir,{recursive:true,force:true})}
});

import {markPanelVisibility} from '../src/attention.js';
test('closing suppresses current and near-term offers without disabling observation',()=>{
 const s=state(); const engine={session:()=>s.session};
 assert.equal(markPanelVisibility(engine,'s',{closed:true},1000),true);
 assert.deepEqual(s.session.seenOpportunityIds,['g']);assert.equal(s.enabled,true);
 s.session.upcomingGoals.id='next';assert.equal(pendingNudge(s,{now:1001}),null);
 assert.equal(s.session.nudgeSuppressedUntil,301000);
 s.session.upcomingGoals.createdAt=300999;assert.equal(pendingNudge(s,{now:300999}),null);
 assert.ok(pendingNudge(s,{now:301000}));
});
test('busy or malformed native notice state is silent and never blocks coding',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-nudge-fault-'));try{
 const run=()=>spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:'s',hook_event_name:'PostToolUse'}),encoding:'utf8'});
 const notice=pendingNudge(state());delete notice.expiresAt;await writeFile(join(dir,'nudge.json'),JSON.stringify(notice));assert.equal(run().stdout,'');
 await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));assert.ok(run().stdout);
 await writeFile(join(dir,'nudge-claims/last.json'),'corrupt');assert.equal(run().stdout,'');assert.equal(run().status,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('a visibility heartbeat is not acknowledgement of an opportunity',()=>{
 const s=state(),engine={session:()=>s.session};
 assert.equal(markPanelVisibility(engine,'s',{visible:true},1000),false);
 assert.equal(s.session.seenOpportunityIds,undefined);
 assert.ok(pendingNudge(s));
});
test('Codex notice hooks use bounded synchronous UI output, with no inference or policy output',async()=>{
 const {readFile}=await import('node:fs/promises');const config=JSON.parse(await readFile(resolve('adapters/codex/plugin/hooks/hooks.json'),'utf8'));
 assert.equal(config.hooks.Stop,undefined);for(const event of ['PostToolUse']){const hook=config.hooks[event][0].hooks[0];assert.notEqual(hook.async,true);assert.equal(hook.timeout,1);assert.equal(hook.type,'command');assert.match(hook.command,/bin\/nudge/);}
});
test('empty invitation fast path skips starting a model or even Node',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-nudge-empty-'));try{
  await writeFile(join(dir,'nudge.json'),'null');
  const result=spawnSync('/bin/zsh',[resolve('adapters/codex/plugin/bin/nudge')],{env:{...process.env,DONTDUMB_STATE_DIR:dir,DONTDUMB_NODE_BIN:'/nonexistent',PATH:'/nonexistent'},input:'{}',encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a Stop hook cannot consume an invitation intended for the coding agent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-ready-stop-'));try{await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));const run=event=>spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:'s',hook_event_name:event}),encoding:'utf8'});assert.equal(run('Stop').stdout,'');assert.ok(run('PostToolUse').stdout);}finally{await rm(dir,{recursive:true,force:true});}
});
test('Claude keeps UI-only notices and receives no coding-context readiness signal',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-ready-claude-'));try{await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state(),{host:'claude'})));const r=spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir,DONTDUMB_HOST:'claude'},input:JSON.stringify({session_id:'s',hook_event_name:'Stop'}),encoding:'utf8'});const v=JSON.parse(r.stdout);assert.deepEqual(Object.keys(v),['systemMessage']);assert.doesNotMatch(r.stdout,/additionalContext/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('readiness accepts native hook event spellings and older missing event fields',async()=>{
 for(const event of ['PostToolUse','postToolUse','post_tool_use',undefined]){const dir=await mkdtemp(join(tmpdir(),'dd-ready-event-'));try{await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));const r=spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:'s',hook_event_name:event}),encoding:'utf8'});assert.ok(JSON.parse(r.stdout).hookSpecificOutput);}finally{await rm(dir,{recursive:true,force:true});}}
});

test('a normal large tool result does not suppress the readiness signal',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-ready-large-'));try{await writeFile(join(dir,'nudge.json'),JSON.stringify(pendingNudge(state())));const r=spawnSync(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{env:{...process.env,DONTDUMB_STATE_DIR:dir},input:JSON.stringify({session_id:'s',hook_event_name:'PostToolUse',tool_response:'x'.repeat(100000)}),encoding:'utf8'});assert.ok(r.stdout);assert.equal(r.status,0);}finally{await rm(dir,{recursive:true,force:true});}
});
test('a stalled hook input exits successfully within the native deadline',async()=>{
 const {spawn}=await import('node:child_process');const child=spawn(process.execPath,[resolve('adapters/codex/plugin/bin/nudge.mjs')],{stdio:['pipe','pipe','pipe']});const start=performance.now();child.stdin.write('{');const kill=setTimeout(()=>child.kill(),1500);const code=await new Promise(resolve=>child.on('close',resolve));clearTimeout(kill);assert.equal(code,0);assert.ok(performance.now()-start<1200);
});
test('launcher treats a broken runtime as an optional notice failure',async()=>{
 const {chmod}=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'dd-ready-launch-'));try{await writeFile(join(dir,'nudge.json'),'{}');const fake=join(dir,'node');await writeFile(fake,'#!/bin/sh\nif [ "$1" = "-e" ]; then exit 0; fi\nexit 17\n');await chmod(fake,0o700);const r=spawnSync('/bin/zsh',[resolve('adapters/codex/plugin/bin/nudge')],{env:{...process.env,DONTDUMB_STATE_DIR:dir,DONTDUMB_NODE_BIN:fake},input:'{}',encoding:'utf8'});assert.equal(r.status,0);}finally{await rm(dir,{recursive:true,force:true});}
});
test('a due review uses the same bounded invitation and respects close acknowledgement',()=>{
 const s={enabled:true,session:{id:'s',reviewOffer:{id:'r',objective:'Retry safety',createdAt:1000}}};assert.equal(pendingNudge(s,{now:5000}).id,'r');
 markPanelVisibility({session:()=>s.session},'s',{closed:true},5000);assert.equal(pendingNudge(s,{now:700000}),null);
});
