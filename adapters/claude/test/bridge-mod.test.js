import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from 'esbuild';
import {readFile} from 'node:fs/promises';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('native worker heartbeats during inference, uses session model, aborts on cancel and cleans up',async()=>{
 const source=await readFile(new URL('../bridge-mod/hooks/register.ts',import.meta.url),'utf8');
 const {code}=await transform(source,{loader:'ts',format:'esm'});
 const {register}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const handlers={},polls=[],calls=[];let callback,cancelled=false,jobSent=false,shouldCancel=false,resolveModel;
 const $={env:{get:async key=>key==='HOME'?'/fixture':null},session:{id:async()=> 'chat-a',cwd:async()=>'/project',model:async()=> 'opus-native',authorize:async()=>({kind:'bearer'})},clock:{every:(_ms,cb)=>{callback=cb;return {cancel(){cancelled=true;}};}},http:{fetch:async(url,options)=>{
   const body=JSON.parse(options.body);polls.push(body);
   assert.equal(body.sessionId,'chat-a');assert.equal(options.socketPath,'/fixture/.local/share/learning-harness/companion/claude/bridge-v2.sock');
   if(url.endsWith('/result'))return {status:204,text:''};
   if(!jobSent){jobSent=true;return {status:200,text:JSON.stringify({job:{id:'j',sessionId:'chat-a',model:null,system:'policy',prompt:'p'}})};}
   return {status:200,text:JSON.stringify(shouldCancel?{cancel:'j'}:{})};
 }},model:{complete:async(request,options)=>{calls.push({request,signal:options.signal});return new Promise(resolve=>{resolveModel=resolve;options.signal.addEventListener('abort',()=>resolve({isAnswered:false,reason:'aborted'}));});}}};
 register((name,fn)=>handlers[name]=fn);
 await handlers['session.start']($,{},async()=>({cwd:'/project'}));await tick();
 assert.equal(calls.length,1);assert.equal(calls[0].request.model,'opus-native');
 for(let i=0;i<5;i++){callback();await tick();}
 assert.equal(polls.length,6);assert.equal(polls.at(-1).activeJobId,'j');assert.equal(calls.length,1);
 shouldCancel=true;callback();await tick();assert.equal(calls[0].signal.aborted,true);
 // End must cancel its timer and must not publish an aborted response.
 await handlers['session.end']($,{},async()=>({}));assert.equal(cancelled,true);assert.equal(polls.filter(p=>p.id==='j').length,0);
 resolveModel?.({isAnswered:true,text:'late'});
});
