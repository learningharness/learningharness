import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {mkdtemp,rm,readdir} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';
const id='12345678-1234-4234-8234-123456789abc';
test('new and resumed chats connect quietly; ordinary coding never asks the agent to create a launcher',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-quiet-entry-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const event of [{hook_event_name:'SessionStart',source:'startup'},{hook_event_name:'UserPromptSubmit',prompt:'Build a cache'},{hook_event_name:'SessionStart',source:'resume'}]){
  const r=spawnSync(process.execPath,[resolve('scripts/claude-release/hook.mjs')],{input:JSON.stringify({session_id:id,cwd:'/synthetic',...event}),encoding:'utf8',env:{...process.env,LEARNING_HARNESS_DATA_DIR:dir}});assert.equal(r.status,0);
  assert(!/show_learning_launcher|show_startup_invitation|As the first UI action/.test(r.stdout));
  if(event.hook_event_name==='SessionStart')assert.match(r.stdout,/chatBinding/);
 }
 assert(!(await readdir(dir)).some(name=>name.endsWith('.requested')));
});
test('opted-in startup requests one exact-chat launcher, including Off; resume and unchecked starts stay quiet',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-session-entry-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const {createStore}=await import('../desktop-runtime/state.mjs');const {resolveChatBinding}=await import('../../adapters/claude/src/chat-binding.js');
 const store=createStore(dir);store.setSessionLauncher(true);
 const run=(session_id=id,source='startup')=>{const r=spawnSync(process.execPath,[resolve('scripts/claude-release/hook.mjs')],{input:JSON.stringify({session_id,cwd:'/synthetic',hook_event_name:'SessionStart',source}),encoding:'utf8',env:{...process.env,LEARNING_HARNESS_DATA_DIR:dir}});assert.equal(r.status,0);return JSON.parse(r.stdout).hookSpecificOutput.additionalContext;};
 const resumed='22345678-1234-4234-8234-123456789abc',unchecked='32345678-1234-4234-8234-123456789abc';
 assert(!run(resumed,'resume').includes('show_learning_launcher'));
 const first=run();assert.match(first,/show_learning_launcher once/);assert.match(first,/do not open or expand/);assert.match(first,/do not enable learning/);
 const binding=first.match(/chatBinding "([a-f0-9]{64})"/)[1];assert.equal(await resolveChatBinding(dir,binding),id);
 assert(!run().includes('show_learning_launcher'));assert(!run(id,'resume').includes('show_learning_launcher'));
 store.setSessionLauncher(false);assert(!run(unchecked).includes('show_learning_launcher'));assert(!run(resumed).includes('show_learning_launcher'));
 assert.equal(store.read().on,false);assert.equal(store.read().showSessionLauncher,false);
 assert(!(await readdir(dir)).some(name=>name.startsWith('watch-')||name.startsWith('chain-')||name==='core'));
});
