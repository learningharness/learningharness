import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {enqueueClaudeHook} from '../src/native-events.js';
import {createClaudeNativeObserver} from '../src/native-host.js';
import {normalizeClaudeEvent} from '../src/observer.js';
const id='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const key=x=>createHash('sha256').update(x).digest('hex');
test('Claude push observations preserve order, scope, redaction and replay deduplication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-claude-'));
 try{
  await enqueueClaudeHook(dir,{session_id:id,hook_event_name:'UserPromptSubmit',prompt:'Build retries',transcript_path:'/never/read'});
  await enqueueClaudeHook(dir,{session_id:id,hook_event_name:'PostToolUse',tool_use_id:'write1',tool_name:'Write',tool_input:{file_path:'/repo/retry.ts',content:'export const retries=3'}});
  await enqueueClaudeHook(dir,{session_id:id,hook_event_name:'PostToolUse',tool_use_id:'secret',tool_name:'Read',tool_input:{file_path:'/repo/.env'}});
  await enqueueClaudeHook(dir,{session_id:other,hook_event_name:'UserPromptSubmit',prompt:'OTHER CHAT'});
  const folder=join(dir,'events',key(id)),files=await readdir(folder);
  assert.equal(files.length,2);
  const stored=await Promise.all(files.map(f=>readFile(join(folder,f),'utf8')));
  assert(!stored.join('').includes('transcript_path'));assert(!stored.join('').includes('.env'));
  let seen=[];const output=[];
  const o=createClaudeNativeObserver({directory:dir,normalize:normalizeClaudeEvent,onEvent:async e=>output.push(e),getSeen:()=>seen,onCheckpoint:async(_,s)=>{seen=s;}});o.attach(id);await o.poll();
  assert.equal(output[0].type,'task.submitted');assert(output.every(e=>e.sessionId===id));assert(!JSON.stringify(output).includes('OTHER CHAT'));
  const count=output.length;
  await enqueueClaudeHook(dir,{session_id:id,hook_event_name:'PostToolUse',tool_use_id:'write1',tool_name:'Write',tool_input:{file_path:'/repo/retry.ts',content:'export const retries=3'}});
  await o.poll();assert.equal(output.length,count);
  assert.equal((await readdir(folder)).length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('cross-chat event inside another chat queue is rejected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-scope-'));try{
  const folder=join(dir,'events',key(id));await mkdir(folder,{recursive:true});await writeFile(join(folder,key('bad')+'.json'),JSON.stringify({sessionId:other,id:'bad'}));
  const o=createClaudeNativeObserver({directory:dir,normalize:normalizeClaudeEvent,onEvent:()=>assert.fail()});o.attach(id);await assert.rejects(o.poll(),/identity mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('public clarification and read evidence can arrive before a code write',async()=>{
 const {publicHookEvent}=await import('../src/native-events.js');const {normalizeClaudeEvent}=await import('../src/observer.js');
 const answer=publicHookEvent({session_id:'chat',hook_event_name:'PostToolUse',tool_name:'AskUserQuestion',tool_response:{answers:{'What should I build?':'HTTP response cache with write invalidation'}}});
 assert.equal(normalizeClaudeEvent(answer)[0].type,'task.submitted');assert.match(normalizeClaudeEvent(answer)[0].data.text,/HTTP response cache/);
 const read=publicHookEvent({session_id:'chat',hook_event_name:'PostToolUse',tool_name:'Read',tool_input:{file_path:'/synthetic/cache.ts'},tool_response:{file:{content:'GET returns an existing cached response; successful writes delete its URL key.'}}});
 const event=normalizeClaudeEvent(read)[0];assert.equal(event.type,'tool.succeeded');assert.match(event.data.content,/successful writes/);
 assert.deepEqual(normalizeClaudeEvent({...read,path:'/repo/.env'}),[]);
});
