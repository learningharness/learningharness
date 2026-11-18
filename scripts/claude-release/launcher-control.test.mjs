import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {claimLauncherRequest,acknowledgeLauncher,acknowledgeAutomaticLauncher} from './launcher-control.mjs';
const id='12345678-1234-4234-8234-123456789abc',other='22345678-1234-4234-8234-123456789abc';
test('early launcher is one exact-chat UI request independent of learning state',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-launcher-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 assert.equal(await claimLauncherRequest(dir,{session_id:id,hook_event_name:'PostToolUse'}),false);
 assert.equal(await claimLauncherRequest(dir,{session_id:id,agent_id:'child',hook_event_name:'SessionStart'}),false);
 assert.equal(await claimLauncherRequest(dir,{session_id:'guess',hook_event_name:'SessionStart'}),false);
 assert.equal(await claimLauncherRequest(dir,{session_id:id,hook_event_name:'SessionStart',prompt:'PRIVATE'}),true);
 assert.equal(await claimLauncherRequest(dir,{session_id:id,hook_event_name:'UserPromptSubmit'}),false);
 assert.equal(await claimLauncherRequest(dir,{session_id:id,hook_event_name:'SessionStart',source:'resume'}),false);
 assert.equal(await claimLauncherRequest(dir,{session_id:other,hook_event_name:'UserPromptSubmit'}),true);
 assert.equal(await acknowledgeLauncher(dir,id),true);assert.equal(await acknowledgeLauncher(dir,id),false);
 const records=await Promise.all((await readdir(dir)).map(f=>readFile(join(dir,f),'utf8')));
 assert(!records.join('').includes('PRIVATE'));assert(!records.join('').includes('prompt'));assert(!records.join('').includes('on'));
});
test('concurrent startup controls claim once and reject unsafe existing receipts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-launcher-race-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const results=await Promise.all(Array.from({length:8},()=>claimLauncherRequest(dir,{session_id:id,hook_event_name:'SessionStart'})));
 assert.equal(results.filter(Boolean).length,1);
 await assert.rejects(acknowledgeLauncher(dir,'newest'));
 await symlink(join(dir,'launcher-'+id+'.requested'),join(dir,'launcher-'+other+'.requested'));
 await assert.rejects(acknowledgeLauncher(dir,other),/Unsafe/);
});

test('a preference revoked after the hook suppresses automatic acknowledgement',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-launcher-revoked-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const {createStore}=await import('../desktop-runtime/state.mjs');const store=createStore(dir);
 store.setSessionLauncher(true);assert.equal(await claimLauncherRequest(dir,{session_id:id,hook_event_name:'SessionStart'}),true);
 store.setSessionLauncher(false);await assert.rejects(acknowledgeAutomaticLauncher(dir,id),/disabled/);
 assert(!(await readdir(dir)).some(name=>name.endsWith('.acknowledged')));
 store.setSessionLauncher(true);assert.equal(await acknowledgeAutomaticLauncher(dir,id),true);await assert.rejects(acknowledgeAutomaticLauncher(dir,id),/already handled/);
});
