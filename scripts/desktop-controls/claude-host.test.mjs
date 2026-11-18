import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createClaudeNativeHost} from '../../adapters/claude/src/native-host.js';
import {issueChatBinding} from '../../adapters/claude/src/chat-binding.js';
import {createDesktopControls} from './service.mjs';
test('real Claude host supplies known descriptor identities to desktop chooser and exact-session creation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-claude-controls-')),state=join(root,'state'),project=join(root,'synthetic-project');await mkdir(project);
 const id='11111111-1111-4111-8111-111111111111';await issueChatBinding(state,{session_id:id,cwd:project});
 const host=await createClaudeNativeHost({directory:join(root,'core'),stateDirectory:state,modelTransport:'cli'});
 const calls=[],records=new Map(),sessions={};let settle;
 const settled=new Promise(resolve=>settle=resolve);
 const engine={state:{enabled:false,globallyStopped:false,sessions},command:async input=>{calls.push(input);if(input.action==='enable')engine.state.enabled=true;if(input.action==='disable')engine.state.enabled=false;return {enabled:engine.state.enabled};},fail:async()=>{}};
 const controls=createDesktopControls({engine,host,mode:{set(){}},jobs:{create:async(job,chatId)=>records.set(job,{chatId}),get:job=>records.get(job),settle:async(job,result)=>{records.set(job,{...records.get(job),...result});settle();}},ensureSession:async chosen=>{calls.push({descriptor:await host.getSession(chosen),id:chosen});},observe:async chosen=>{const observer=host.createObserver({normalize:host.normalize,onEvent:()=>assert.fail('No work events exist in fixture')});observer.attach(chosen);await observer.poll();}});
 try{
  const result=await controls('desktop-chats');assert.deepEqual(result,{enabled:false,chats:[{id,title:'Claude Code · 11111111',project:'synthetic-project',paused:false}]});assert.equal(calls.length,0);
  await controls('desktop-action',{action:'on'});
  const job=await controls('desktop-action',{action:'new-moment',id});await settled;
  assert.deepEqual(calls,[{action:'enable'},{descriptor:{title:'Claude Code · 11111111',project},id},{action:'new-moment',sessionID:id}]);
  assert.deepEqual(await controls('desktop-job',{id,job:job.job}),{status:'ready'});
  await controls('desktop-action',{action:'off'});assert.equal(engine.state.enabled,false);
 }finally{await host.close();await rm(root,{recursive:true,force:true});}
});
