import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const goal={kind:'core',outcome:'Explain cache expiry ownership',whyNow:'The implementation combines expiry and coalescing.',minutes:3,insight:'Expiry removes cached data without granting an old load ownership.'};
const offer={text:JSON.stringify({tool:'suggest_goals',reason:'New actual cache work',input:{goals:[goal]}}),usage:{input:20,output:20}};
async function fixture(t,generate){
 let clock=Date.parse('2026-11-10T17:00:00Z'),calls=0;
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},now:()=>new Date(clock).toISOString(),debounceMs:1,proactiveFollowup:true,automaticMinIntervalMs:80,maxAutomaticChecksPerTask:2,maxAutomaticChecksPerWindow:3,defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:['task.submitted','file.changed']},model:{independent:true},surface:{}},gateway:{generate:async input=>{calls++;return generate(calls,input);}}});
 t.after(()=>{for(const timer of engine.parallelTimers.values())clearTimeout(timer);});await engine.load();await engine.command({action:'enable'});
 return{engine,calls:()=>calls,advance:ms=>clock+=ms,event:(id,type,data)=>engine.onWorkEvent({id,type,data,sessionId:'work'})};
}
const waitFor=async predicate=>{const until=Date.now()+1500;while(!predicate()){if(Date.now()>until)throw Error('No automatic wake-up after new work');await new Promise(resolve=>setTimeout(resolve,5));}};
test('a short acknowledgement waits for real files without spending an early model call',async t=>{
 const f=await fixture(t,()=>offer);await f.event('ack','task.submitted',{text:'Yes, implement it'});await f.engine.consider('work');assert.equal(f.calls(),0);
 await f.event('code','file.changed',{path:'cache.js',content:'getOrLoad checks expiry before joining inflight work'});
 await waitFor(()=>f.engine.session('work').goals?.list?.length);assert.equal(f.calls(),1);
});
test('new files after a silent early check wake automatically when cooldown ends, without another event',async t=>{
 const f=await fixture(t,count=>count===1?{text:JSON.stringify({tool:'stay_silent',reason:'No concrete implementation yet',input:{reason:'Wait for concrete implementation'}}),usage:{input:20,output:10}}:offer);
 await f.event('task','task.submitted',{text:'Implement cache expiry'});await f.engine.consider('work');assert.equal(f.calls(),1);
 await f.event('code','file.changed',{path:'cache.js',content:'actual expiry branch'});assert.equal(f.calls(),1);assert(f.engine.parallelTimers.has('work'));
 f.advance(81);await waitFor(()=>f.engine.session('work').goals?.list?.length);assert.equal(f.calls(),2);
 assert.equal(f.engine.session('work').automaticChecksThisTask,2);
});
test('turning learning Off cancels a deferred check before it can spend tokens',async t=>{
 const f=await fixture(t,()=>offer);await f.event('task','task.submitted',{text:'Implement cache expiry'});await f.engine.consider('work');
 await f.event('code','file.changed',{path:'cache.js',content:'actual expiry branch'});assert(f.engine.parallelTimers.has('work'));
 await f.engine.command({action:'disable'});f.advance(81);await new Promise(resolve=>setTimeout(resolve,100));assert.equal(f.calls(),1);assert.equal(f.engine.parallelTimers.size,0);
});
test('new work arriving during a check wakes again while preserving the active lesson and draft',async t=>{
 let release,entered;const started=new Promise(resolve=>entered=resolve);
 const f=await fixture(t,count=>{if(count===1){entered();return new Promise(resolve=>release=()=>resolve(offer));}return offer;});
 const session=f.engine.session('work');session.moment={id:'active',kind:'explain',body:'Keep this teaching',completed:false};session.draft={answer:'Keep this reasoning'};
 await f.event('task','task.submitted',{text:'Implement cache expiry'});for(const timer of f.engine.parallelTimers.values())clearTimeout(timer);f.engine.parallelTimers.clear();session.parallelScheduled=false;
 const first=f.engine.consider('work');await started;
 await f.event('new-code','file.changed',{path:'cache.js',content:'New code arrived during the first check'});f.advance(81);release();await first;
 await waitFor(()=>f.calls()===2);await f.engine.considerations.get('work');assert.equal(session.moment.id,'active');assert.equal(session.draft.answer,'Keep this reasoning');
});
test('pause cancels a deferred check and resume restores it without consuming the opportunity',async t=>{
 const f=await fixture(t,()=>offer);await f.event('task','task.submitted',{text:'Implement cache expiry'});await f.engine.consider('work');
 await f.event('code','file.changed',{path:'cache.js',content:'actual expiry branch'});assert(f.engine.parallelTimers.has('work'));
 await f.engine.command({action:'pause',sessionID:'work'});f.advance(81);await new Promise(resolve=>setTimeout(resolve,100));assert.equal(f.calls(),1);assert.equal(f.engine.session('work').automaticChecksThisTask,1);
 await f.engine.command({action:'resume',sessionID:'work'});await waitFor(()=>f.calls()===2);await f.engine.considerations.get('work');assert.equal(f.engine.session('work').automaticChecksThisTask,2);
});
test('pausing during model selection does not spend an automatic opportunity',async t=>{
 const f=await fixture(t,()=>offer);let release,entered;const started=new Promise(resolve=>entered=resolve),resolveModel=f.engine.resolveModel.bind(f.engine);let first=true;
 f.engine.resolveModel=async(...args)=>{if(first){first=false;entered();await new Promise(resolve=>release=resolve);}return resolveModel(...args);};
 await f.event('task','task.submitted',{text:'Implement cache expiry'});for(const timer of f.engine.parallelTimers.values())clearTimeout(timer);f.engine.parallelTimers.clear();f.engine.session('work').parallelScheduled=false;
 const pending=f.engine.consider('work');await started;await f.engine.command({action:'pause',sessionID:'work'});release();await pending;
 assert.equal(f.calls(),0);assert.equal(f.engine.session('work').automaticChecksThisTask,0);
});
