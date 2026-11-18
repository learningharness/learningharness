import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
test('readiness projection immediately selects queued learning and preserves delivered timestamps',()=>{
 const session={workSelection:{task:{id:'task'}},goals:{list:[{outcome:'Current'}]},upcomingGoals:{list:[{outcome:'New'}]}};
 const next=projectRuntimeInvitation(session,null,1000);assert.equal(next.runtimeKey,'task:New');assert.equal(next.readyAt,1000);
 const delivered={...next,signalAt:1100,cardAt:1200};assert.equal(projectRuntimeInvitation(session,delivered,2000),null);
 assert.equal(projectRuntimeInvitation({...session,paused:true},delivered,2000).status,'stale');
 assert.equal(projectRuntimeInvitation({...session,workSelection:{task:{id:'other'}}},delivered,2000).status,'stale');
});
test('ready hook emits one generic signal only for matching enabled chat',async()=>{const dir=await mkdtemp(join(tmpdir(),'dd-chain-'));const id='11111111-1111-1111-1111-111111111111';const path=join(dir,'chain-'+id+'.json');try{await writeFile(join(dir,'state.json'),JSON.stringify({on:true}));await writeFile(path,JSON.stringify({status:'ready',result:{question:'PRIVATE QUESTION',source:{title:'PRIVATE TITLE'}}}));const run=session_id=>spawnSync(process.execPath,[resolve('scripts/desktop-runtime/chain-hook.mjs')],{input:JSON.stringify({session_id}),env:{...process.env,DONTDUMB_PROBE_DATA:dir},encoding:'utf8'});assert.equal(run('22222222-2222-2222-2222-222222222222').stdout,'');const first=run(id);assert.equal(first.status,0);assert.match(first.stdout,/show_ready_invitation/);assert.doesNotMatch(first.stdout,/PRIVATE/);assert.equal(run(id).stdout,'');assert(JSON.parse(await readFile(path,'utf8')).signalAt);await writeFile(path,JSON.stringify({status:'ready'}));await writeFile(join(dir,'visible-'+id+'.json'),JSON.stringify({until:Date.now()+10000}));assert.equal(run(id).stdout,'');await rm(join(dir,'visible-'+id+'.json'));await writeFile(join(dir,'state.json'),JSON.stringify({on:false}));await writeFile(path,JSON.stringify({status:'ready'}));assert.equal(run(id).stdout,'');}finally{await rm(dir,{recursive:true,force:true});}});

test('new ready teaching content re-arms delivery after the sidebar was opened, without repeating it',()=>{
 const session={workSelection:{task:{id:'task'}},moment:{id:'moment-new',title:'Four strokes',body:'Teaching content'}};
 const old={runtime:true,status:'ready',runtimeKey:'task:topic',taskId:'task',readyAt:1000,cardAt:1100,signalAt:1050};
 const next=projectRuntimeInvitation(session,old,2000);
 assert.equal(next?.runtimeKey,'moment:moment-new');assert.equal(next.cardAt,undefined);assert.equal(next.signalAt,undefined);
 assert.equal(projectRuntimeInvitation(session,{...next,cardAt:2100},2200),null);
 assert.equal(projectRuntimeInvitation({...session,paused:true},next,2300).status,'stale');
});

test('new topics remain deliverable shortly after a previous invitation',()=>{
 const old={runtime:true,status:'ready',runtimeKey:'task:Old',taskId:'task',readyAt:1000,signalAt:1100,cardAt:1200};
 const session={workSelection:{task:{id:'task'}},goals:{list:[{outcome:'New'}]}};
 const next=projectRuntimeInvitation(session,old,2000);
 assert.equal(next.runtimeKey,'task:New');assert.equal(next.signalAt,undefined);
 assert.equal(projectRuntimeInvitation(session,{...next,signalAt:2100},2200),null);
});

test('a substantive new user task invalidates the old prepared topic before delivery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-stale-topic-'));const id='11111111-1111-1111-1111-111111111111';
 try{await writeFile(join(dir,'state.json'),JSON.stringify({on:true}));await writeFile(join(dir,'chain-'+id+'.json'),JSON.stringify({runtime:true,status:'ready',runtimeKey:'old',preparedTarget:{title:'Readiness'}}));
 const result=spawnSync(process.execPath,[resolve('scripts/desktop-runtime/chain-hook.mjs')],{input:JSON.stringify({session_id:id,hook_event_name:'UserPromptSubmit',prompt:'Fix the external toast delivery and hotkeys'}),env:{...process.env,DONTDUMB_PROBE_DATA:dir},encoding:'utf8'});
 assert.doesNotMatch(result.stdout,/show_ready_invitation/);assert.equal(JSON.parse(await readFile(join(dir,'chain-'+id+'.json'),'utf8')).status,'stale');
 }finally{await rm(dir,{recursive:true,force:true});}
});
