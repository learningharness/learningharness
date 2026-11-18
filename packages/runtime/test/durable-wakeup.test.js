import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const offer={text:JSON.stringify({tool:'suggest_goals',reason:'New cache work',input:{goals:[{kind:'core',outcome:'Explain cache ownership',whyNow:'Actual cache work',minutes:3,insight:'Identity protects cache ownership.'}]}}),usage:{input:20,output:20}};
async function fixture(t){
 let value,writeGate=null,clock=Date.parse('2026-11-14T17:00:00Z'),calls=0;const engines=[];
 const make=()=>{const e=new LearningEngine({storage:{get:async()=>structuredClone(value),set:async(_,next)=>{if(writeGate)await writeGate;value=structuredClone(next);}},now:()=>new Date(clock).toISOString(),debounceMs:40,proactiveFollowup:true,automaticMinIntervalMs:40,maxAutomaticChecksPerTask:2,defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:['task.submitted','file.changed']},model:{independent:true},surface:{}},gateway:{generate:async()=>{calls++;return offer;}}});engines.push(e);return e;};
 t.after(()=>engines.forEach(e=>{for(const timer of e.parallelTimers.values())clearTimeout(timer);}));
 const first=make();await first.load();await first.command({action:'enable'});
 const event=(id,type,data)=>first.onWorkEvent({id,type,data,sessionId:'work'});
 const crash=()=>{for(const timer of first.parallelTimers.values())clearTimeout(timer);first.parallelTimers.clear();};
 return{first,make,event,crash,blockWrites(){let release;writeGate=new Promise(resolve=>release=resolve);return()=>{writeGate=null;release();};},get saved(){return value;},calls:()=>calls,advance:ms=>clock+=ms};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('a committed automatic intent survives restart and runs once without another event',async t=>{
 const f=await fixture(t);await f.event('task','task.submitted',{text:'Implement cache expiry'});f.crash();
 assert.equal(f.saved.sessions.work.automaticWakeup.kind,'opportunity');assert.equal(f.calls(),0);
 const restored=f.make();await restored.load({resumeEnabled:true});await wait(100);assert.equal(f.calls(),1);assert(restored.session('work').goals);assert.equal(restored.session('work').automaticWakeup,null);
 const again=f.make();await again.load({resumeEnabled:true});await wait(70);assert.equal(f.calls(),1);
});
test('Off, paused, expired, and non-resuming restarts do not dispatch saved work',async t=>{
 for(const condition of ['off','paused','expired','not-resuming']){
  const f=await fixture(t);await f.event('task','task.submitted',{text:'Implement cache expiry'});f.crash();
  if(condition==='off')await f.first.command({action:'disable'});
  if(condition==='paused')await f.first.command({action:'pause',sessionID:'work'});
  if(condition==='expired')f.advance(31*60*1000);
  const restored=f.make();await restored.load({resumeEnabled:condition!=='not-resuming'});await wait(80);assert.equal(f.calls(),0,condition);
 }
});
test('interrupted paid requests stay interrupted and unknown usage survives, rather than replaying',async t=>{
 const f=await fixture(t);await f.event('task','task.submitted',{text:'Implement cache expiry'});f.crash();
 const s=f.first.session('work');s.pendingUsage=true;s.requestStatus={status:'pending',kind:'ask'};f.first.state.ledger.aborted={status:'pending',parentSessionId:'work',input:12,output:0};await f.first.persist();
 const restored=f.make();await restored.load({resumeEnabled:true});await wait(90);assert.equal(f.calls(),0);assert.equal(restored.session('work').requestStatus.status,'error');assert.equal(restored.state.ledger.aborted.status,'unreported');assert.equal(restored.state.usage.unreportedCalls,1);
});

test('no automatic dispatch precedes durable intent persistence',async t=>{
 const f=await fixture(t),release=f.blockWrites();
 const work=f.event('task','task.submitted',{text:'Implement cache expiry'});
 await wait(100);assert.equal(f.calls(),0);assert.equal(f.first.parallelTimers.size,0);
 release();await work;await wait(100);assert.equal(f.calls(),1);
});
test('a recovered intent honors the remaining automatic cooldown',async t=>{
 const f=await fixture(t);await f.event('task','task.submitted',{text:'Implement cache expiry'});f.crash();
 const s=f.first.session('work');s.automaticCheckTimes=[Date.parse(f.first.now())];f.first.automaticMinIntervalMs=220;s.automaticWakeup.dueAt=Date.parse(f.first.now())+220;await f.first.persist();
 const restored=f.make();restored.automaticMinIntervalMs=220;await restored.load({resumeEnabled:true});await wait(90);assert.equal(f.calls(),0);f.advance(221);await wait(180);assert.equal(f.calls(),1);
});
