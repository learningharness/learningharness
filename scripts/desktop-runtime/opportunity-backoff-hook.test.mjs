import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';
for(const [host,script] of [['codex','scripts/desktop-runtime/chain-hook.mjs'],['claude','scripts/claude-release/hook.mjs']])test(host+' hooks enforce two-turn backoff across a replacement topic',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lh-hook-backoff-')),id='11111111-1111-4111-8111-111111111111';
 try{
 writeFileSync(join(dir,'state.json'),JSON.stringify({on:true}));
 const ready=()=>writeFileSync(join(dir,'chain-'+id+'.json'),JSON.stringify({status:'ready',runtime:true,runtimeKey:'new-topic'}));
 const run=hook_event_name=>{const r=spawnSync(process.execPath,[resolve(script)],{input:JSON.stringify({session_id:id,cwd:'/synthetic/project',hook_event_name,prompt:'continue'}),env:{...process.env,LEARNING_HARNESS_DATA_DIR:dir,DONTDUMB_PROBE_DATA:dir},encoding:'utf8'});assert.equal(r.status,0);return r.stdout;};
 ready();assert.match(run('PostToolUse'),/show_ready_invitation/);ready();
 assert.doesNotMatch(run('PostToolUse'),/show_ready_invitation/);
 run('UserPromptSubmit');assert.doesNotMatch(run('PostToolUse'),/show_ready_invitation/);
 const next=run('UserPromptSubmit')+run('PostToolUse');assert.match(next,/show_ready_invitation/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
