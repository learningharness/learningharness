import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodexNativeHost} from '../src/native-host.js';
import {assertNativeHost} from '../../../packages/hosts/src/native-host.js';
test('Codex RPC and checkpoint migration are owned by the host adapter',async()=>{
 const calls=[];
 const host=await createCodexNativeHost({},async()=>({id:'codex',catalog:[{model:'fixture'}],gateway:{rpc:{request:async(...args)=>{calls.push(args);return {thread:{name:'Retries',cwd:'/fixture'}};}}},createObserver(){},close(){}}));
 assertNativeHost(host);
 assert.deepEqual(await host.getSession('chat'),{title:'Retries',project:'/fixture'});
 assert.deepEqual(calls,[['thread/read',{threadId:'chat',includeTurns:false}]]);
 assert.deepEqual(host.checkpoint({codexSeen:[['old','hash']]}),[['old','hash']]);
 assert.deepEqual(host.presentation.entryMetadata('chat'),{'openai/ui':{entrypoints:[{type:'thread'}]}});
});
test('opening context reads the oldest user message in full without loading the whole thread',async()=>{
 const calls=[];const text='Explain the sidecar architecture. '+ 'Detailed first-message context. '.repeat(180)+'END_OF_OPENING';
 const host=await createCodexNativeHost({},async()=>({gateway:{rpc:{request:async(name,args)=>{calls.push([name,args]);return name==='thread/turns/list'?{data:[{id:'first-turn'}]}:{data:[{item:{id:'user-first',type:'userMessage',content:[{type:'text',text}]}}]};}}}}));
 assert.deepEqual(await host.getOpeningContext('exact-chat'),{id:'user-first',text});
 assert.equal(calls[0][1].sortDirection,'asc');assert.equal(calls[1][1].sortDirection,'asc');
 assert.ok(calls.every(([,args])=>args.threadId==='exact-chat'));
});
test('opening lookup follows oldest item pages and excludes non-text and private reasoning',async()=>{
 const host=await createCodexNativeHost({},async()=>({gateway:{rpc:{request:async(name,args)=>{
  if(name==='thread/turns/list')return{data:[{id:'first-turn'}]};
  if(!args.cursor)return{data:[{item:{type:'reasoning',text:'PRIVATE'}}],nextCursor:'next'};
  return{data:[{item:{id:'first',type:'userMessage',content:[{type:'image',url:'PRIVATE_IMAGE'},{type:'text',text:'Explain architecture api_key=sk-abcdefghijklmnopqrstuv'}]}}]};
 }}}}));
 const result=await host.getOpeningContext('chat');assert.equal(result.id,'first');assert.match(result.text,/Explain architecture/);
 assert.ok(!/PRIVATE|sk-abcdefghijklmnopqrstuv/.test(result.text));
});
test('connection status reflects a disconnected owned app-server',async()=>{
 const rpc={closed:false};const host=await createCodexNativeHost({},async()=>({gateway:{rpc}}));
 assert.equal((await host.connection()).connected,true);rpc.closed=true;assert.equal((await host.connection()).connected,false);
});
test('opening context recognizes only the explicit native task-dispatch wrapper',async()=>{
 const host=await createCodexNativeHost({},async()=>({gateway:{rpc:{request:async name=>name==='thread/turns/list'?{data:[{id:'turn'}]}:{data:[{item:{type:'functionCallOutput',namespace:'codex_app',name:'create_thread',id:'opening',output:'<codex_delegation>\n<source_thread_id>other</source_thread_id>\n<input>Build a cache</input>\n</codex_delegation>'}}]}}}}));
 assert.deepEqual(await host.getOpeningContext('exact'),{id:'opening',text:'Build a cache'});
});
