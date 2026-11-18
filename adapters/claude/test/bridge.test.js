import test from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';import {mkdtemp,stat,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createSubscriptionBridge} from '../src/bridge.js';import {ClaudeLearningGateway} from '../src/host.js';
const call=(socketPath,path,body)=>new Promise((resolve,reject)=>{const req=request({socketPath,path,method:'POST',headers:{'Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,...(text?JSON.parse(text):{})}));});req.on('error',reject);req.end(JSON.stringify(body));});
const worker=(sessionId='s',auth='bearer')=>({version:2,sessionId,workerId:'worker-'+sessionId,auth,model:'opus-native',cwd:'/fixture',activeJobId:null});
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'dd-bridge-')),socketPath=join(dir,'bridge.sock');let time=10000;const bridge=createSubscriptionBridge({socketPath,now:()=>time});await bridge.listening;t.after(async()=>{await bridge.close();await rm(dir,{recursive:true,force:true});});return {bridge,socketPath,poll:w=>call(socketPath,'/v2/poll',w),advance:n=>time+=n};}
test('private socket, unavailable sessions, and exact identity routing',async t=>{
 const f=await setup(t);assert.equal((await stat(f.socketPath)).mode&0o777,0o600);assert.equal(f.bridge.connected('s'),false);
 await assert.rejects(f.bridge.request({parentSessionId:'s',prompt:'p'}),{code:'BRIDGE_UNAVAILABLE'});
 await f.poll(worker('s'));const pending=f.bridge.request({parentSessionId:'s',prompt:'p',system:'policy',model:null});
 assert.equal((await f.poll(worker('other'))).job,undefined);
 const claimed=await f.poll(worker('s'));assert.equal(claimed.job.sessionId,'s');assert.equal(claimed.job.model,null);
 assert.equal((await call(f.socketPath,'/v2/result',{...worker('other'),id:claimed.job.id,isAnswered:true,text:'wrong'})).status,404);
 await call(f.socketPath,'/v2/result',{...worker('s'),id:claimed.job.id,isAnswered:true,text:'answer'});assert.equal((await pending).text,'answer');
});
test('busy workers keep their lease and another API-key session cannot revoke it',async t=>{
 const f=await setup(t);await f.poll(worker());const p=f.bridge.request({parentSessionId:'s',prompt:'p'}).catch(e=>e);
 const {job}=await f.poll(worker());for(let i=0;i<5;i++){f.advance(3000);await f.poll({...worker(),activeJobId:job.id});await f.poll(worker('api','api-key'));assert.equal(f.bridge.connected('s'),true);assert.equal(f.bridge.connected('api'),false);}
 f.bridge.cancel('s');await p;
});
test('cancellation and deadline notify only the owning worker; late replies are rejected',async t=>{
 const f=await setup(t);await f.poll(worker());const p=f.bridge.request({parentSessionId:'s',prompt:'p'}).catch(e=>e);const {job}=await f.poll(worker());
 f.bridge.cancel('other');assert.equal((await f.poll({...worker(),activeJobId:job.id})).cancel,undefined);
 f.bridge.cancel('s');assert.match((await p).message,/cancel/);assert.equal((await f.poll({...worker(),activeJobId:job.id})).cancel,job.id);
 assert.equal((await call(f.socketPath,'/v2/result',{...worker(),id:job.id,isAnswered:true,text:'late'})).status,404);
 const timeout=f.bridge.request({parentSessionId:'s',prompt:'p',timeout:20}).catch(e=>e);const {job:timed}=await f.poll(worker());assert.match((await timeout).message,/timed out/);assert.equal((await f.poll({...worker(),activeJobId:timed.id})).cancel,timed.id);
});
test('gateway uses exact native session, preserves default model and never silently falls back',async t=>{
 const f=await setup(t);await f.poll(worker());let spawned=0;const g=new ClaudeLearningGateway({directory:tmpdir(),bridge:f.bridge,spawnProcess:()=>{spawned++;throw new Error('CLI forbidden');}});
 const result=g.generate({role:'learner',parentSessionId:'s',model:{providerID:'claude',modelID:'default'},prompt:'p',onPrepared:async()=>{}});
 let job;for(let i=0;i<20&&!job;i++){job=(await f.poll(worker())).job;}
 assert.equal(job.model,null);await call(f.socketPath,'/v2/result',{...worker(),id:job.id,isAnswered:true,text:'ok',usage:{input_tokens:2,output_tokens:1}});assert.equal((await result).usage.input,2);
 f.advance(10000);await assert.rejects(g.authenticate('s'),{code:'BRIDGE_UNAVAILABLE'});assert.equal(spawned,0);
});
test('a live socket is never unlinked by a second server',async t=>{
 const f=await setup(t);const second=createSubscriptionBridge({socketPath:f.socketPath});await assert.rejects(second.listening);await second.close();await f.poll(worker());assert.equal(f.bridge.connected('s'),true);
});
test('duplicate workers cannot steal a live lease; pending limit includes claimed jobs',async t=>{
 const f=await setup(t);await f.poll(worker());
 const pending=Array.from({length:8},()=>f.bridge.request({parentSessionId:'s',prompt:'private'}).catch(e=>e));
 const {job}=await f.poll(worker());assert.ok(job);
 await assert.rejects(f.bridge.request({parentSessionId:'s',prompt:'overflow'}),/busy/);
 assert.equal((await f.poll({...worker(),workerId:'duplicate'})).status,409);
 f.advance(9000);assert.equal((await f.poll({...worker(),workerId:'duplicate'})).status,200);
 assert.match((await pending[0]).message,/cancel/);await Promise.all(pending);
});
test('artifact building can use the existing subscription Haiku route and honors the output reservation',async t=>{
 const f=await setup(t);await f.poll(worker());const g=new ClaudeLearningGateway({directory:tmpdir(),bridge:f.bridge});g.setContentBuilderModel(g.defaultContentBuilderModel);
 const pending=g.generate({role:'content-builder',parentSessionId:'s',model:{providerID:'claude',modelID:'default'},prompt:'artifact',reservation:{output:2048},onPrepared:async()=>{}});
 let job;for(let i=0;i<20&&!job;i++)job=(await f.poll(worker())).job;
 assert.equal(job.model,'haiku');assert.equal(job.maxTokens,2048);
 await call(f.socketPath,'/v2/result',{...worker(),id:job.id,isAnswered:true,text:'{}'});await pending;
});
