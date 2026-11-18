import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const caps={host:'fixture',observation:{kinds:['task.submitted','turn.started','file.changed','assistant.ended']},model:{independent:true},surface:{experiments:false}};
const make=(opts={})=>new LearningEngine({storage:{get:async()=>null,set:async()=>{}},capabilities:caps,defaultLearningModel:{providerID:'native',modelID:'small'},debounceMs:60000,proactiveFollowup:true,maxAutomaticChecksPerTask:2,maxGoalRequests:1,...opts});
const goal={kind:'core',outcome:'Retry safety',whyNow:'Your HTTP retry helper can repeat a successful operation',minutes:2,insight:'A lost response does not mean the server did nothing.',path:['Retries','Idempotency']};
const result=()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:[goal]},reason:'Task grounding'}),usage:{input:20,output:20}});
const clear=e=>{for(const t of e.parallelTimers.values())clearTimeout(t);};
test('opening a session offers a due relevant refresher without inference; skip snoozes it',async()=>{
 let calls=0;const evidence=[{id:'old',momentId:'old',objective:'Retry safety',project:'payments',createdAt:'2026-01-01T00:00:00Z',verdict:'correct'}];
 const data={profile:{goals:[],known:[],preferences:''},evidence,reviewSnoozes:{}};
 const e=make({now:()=> '2026-01-03T00:00:00Z',learnerStore:{read:async()=>data,mergeEvidence:async()=>data,snoozeReview:async(key,until)=>{data.reviewSnoozes[key]=until;return data;}},gateway:{generate:async()=>{calls++;return result();}}});
 await e.load();await e.command({action:'enable'});await e.openSession('w',{title:'New chat',project:'/work/payments'});
 assert.equal(e.snapshot('w').session.reviewOffer.objective,'Retry safety');assert.equal(calls,0);
 await e.command({action:'skip-review',sessionID:'w'});assert.equal(e.snapshot('w').session.reviewOffer,null);assert.equal(data.evidence.length,1);
 await e.openSession('next',{project:'/work/payments'});assert.equal(e.snapshot('next').session.reviewOffer,null);clear(e);
});
test('initial planner sees weighted title/profile/task and a turn-start cannot starve its result',async()=>{
 let finish,captured;const e=make({gateway:{generate:async input=>{captured=input;return new Promise(resolve=>{finish=()=>resolve(result());});}}});
 try{await e.load();await e.command({action:'enable'});await e.openSession('w',{title:'TypeScript retry helper',project:'payments'});
 await e.command({action:'save-learner-profile',value:{goals:['Understand cancellation'],known:[],preferences:'Short visual examples'}});
 await e.onWorkEvent({id:'task',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper with cancellation'}});
 const pending=e.consider('w');for(let n=0;n<30&&!finish;n++)await new Promise(r=>setImmediate(r));assert.ok(finish);
 await e.onWorkEvent({id:'turn',sessionId:'w',type:'turn.started',data:{}});finish();await pending;
 assert.equal(e.snapshot('w').session.goals.list.length,1);assert.match(captured.prompt,/TypeScript retry helper/);assert.match(captured.prompt,/Understand cancellation/);assert.match(captured.prompt,/strongest|100/);
 assert.equal(e.opportunityTimeoutMs,20000);
 }finally{clear(e);}
});
test('thin acknowledgements do not spend opportunity calls or fabricate title-based goals',async()=>{
 let calls=0;const e=make({gateway:{generate:async()=>{calls++;return result();}}});
 try{await e.load();await e.command({action:'enable'});await e.openSession('w',{title:'New chat'});await e.onWorkEvent({id:'hi',sessionId:'w',type:'task.submitted',data:{text:'Thanks'}});await e.consider('w');assert.equal(calls,0);assert.equal(e.snapshot('w').session.goals,null);}finally{clear(e);}
});
test('execution start preserves the scheduled initial offer, without waiting for final output',async()=>{
 let ready;const called=new Promise(resolve=>{ready=resolve;});let calls=0;
 const e=make({debounceMs:5,gateway:{generate:async()=>{calls++;ready();return result();}}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'task',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});await e.onWorkEvent({id:'start',sessionId:'w',type:'turn.started',data:{}});
 await Promise.race([called,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Initial task timer lost')),300);t.unref();})]);
 await e.considerations.get('w');assert.equal(calls,1);assert.equal(e.snapshot('w').session.goals.list[0].outcome,'Retry safety');
 }finally{clear(e);}
});
test('a failed review request preserves its offer and the previous completed lesson',async()=>{
 const e=make({gateway:{generate:async()=>{throw Error('offline');}}});await e.load();await e.command({action:'enable'});
 e.session('prior').evidence=[{id:'old',momentId:'old',objective:'Retry safety',project:'payments',verdict:'correct',createdAt:'2025-01-01T00:00:00Z'}];await e.openSession('w',{project:'payments'});const s=e.session('w'),offerId=s.reviewOffer.id;s.moment={id:'previous',completed:true};
 await assert.rejects(e.command({action:'start-review',sessionID:'w'}));assert.equal(s.reviewOffer.id,offerId);assert.equal(s.moment.id,'previous');assert.equal(s.moment.reviewKey,undefined);clear(e);
});
test('a startup refresher assesses a fresh attempt and advances the local due date',async()=>{
 const old={id:'old',momentId:'old',objective:'Retry safety',project:'payments',createdAt:'2026-01-01T00:00:00Z',verdict:'correct'};
 const data={profile:{goals:[],known:[],preferences:''},evidence:[old],reviewSnoozes:{}};
 const e=make({now:()=> '2026-01-03T00:00:00Z',learnerStore:{read:async()=>data,mergeEvidence:async(_,evidence)=>{for(const item of evidence)if(!data.evidence.some(e=>e.id===item.id))data.evidence.push(item);return data;},noteExploration:async()=>data},gateway:{generate:async input=>({text:JSON.stringify(input.intent==='assessment'?{tool:'assess_answer',input:{verdict:'correct',feedback:'The response can be lost after the server commits.',next:'Try a new case.',adaptation:{observation:'The learner distinguished response loss from failure.',focus:'A fresh retry boundary.'},evidenceLabel:'first_independent_evidence'},reason:'Correct mechanism'}:{tool:'present',input:{experience:{decision:'offer',kind:'predict',learningDesign:{version:1,newAbility:'Recall retry safety',distinction:{left:'A lost response',right:'A failed operation'},addsBeyond:'A fresh recall question',capability:'explain',approach:'challenge_first',basis:{kind:'exposure',evidenceIds:[]}},title:'A lost reply',objective:'Retry safety',relevance:'A due review',body:'A payment succeeds but its response is lost.',question:'Is repeating an unkeyed POST safe?',rubric:'No, it can create a duplicate payment.',hook:'Recall the retry boundary'},sourceIds:[]},reason:'Fresh retrieval question'}),usage:{input:30,output:30}})}});
 try{await e.load();await e.command({action:'enable'});await e.openSession('w',{project:'payments'});await e.command({action:'start-review',sessionID:'w'});assert.equal(e.session('w').moment.reviewKey,'retry safety');assert.equal(e.session('w').reviewOffer,null);
 await e.command({action:'submit',sessionID:'w',value:'No, the server may already have created the payment.'});assert.equal(e.session('w').evidence[0].conditions.mode,'review');assert.equal(e.snapshot('w').learner.reviews[0].dueAt,'2026-01-10T00:00:00.000Z');
 }finally{clear(e);}
});
test('fast host planning stays separate from teaching and explicit preference wins',async()=>{
 const models=[];const e=make({gateway:{defaultContextModel:{providerID:'native',modelID:'fast'},generate:async input=>{models.push(input.model.modelID);return result();}}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'t',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});await e.consider('w');assert.equal(models[0],'fast');assert.equal((await e.resolveModel('w')).modelID,'small');
 await e.command({action:'set-context-model',value:{providerID:'native',modelID:'preferred'}});await e.command({action:'suggest',sessionID:'w'});assert.equal(models[1],'preferred');
 }finally{clear(e);}
});
test('unrelated task changes clear a hidden review; starting it rechecks shared snoozes',async()=>{
 const data={profile:{goals:[],known:[],preferences:''},reviewSnoozes:{},evidence:[{id:'old',momentId:'old',objective:'Retry safety',project:'payments',verdict:'correct',createdAt:'2026-01-01T00:00:00Z'}]};
 const e=make({now:()=> '2026-01-03T00:00:00Z',learnerStore:{read:async()=>data,mergeEvidence:async()=>data},gateway:{generate:async()=>{throw Error('Unexpected inference');}}});
 try{await e.load();await e.command({action:'enable'});await e.openSession('w',{project:'payments'});assert.ok(e.session('w').reviewOffer);
 e.session('w').moment={id:'active',completed:false};await e.onWorkEvent({id:'css',sessionId:'w',type:'task.submitted',data:{text:'Fix CSS layout for the website'}});assert.equal(e.session('w').reviewOffer,null);
 e.session('w').moment=null;await e.onWorkEvent({id:'retry',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});assert.ok(e.session('w').reviewOffer);
 data.reviewSnoozes['retry safety']='2026-01-04T00:00:00Z';await assert.rejects(e.command({action:'start-review',sessionID:'w'}),/no longer due/);assert.equal(e.session('w').reviewOffer,null);
 }finally{clear(e);}
});
test('an explanation cannot replace a retrieval review or consume its offer',async()=>{
 const e=make({gateway:{generate:async()=>({text:JSON.stringify({tool:'present',input:{experience:{decision:'offer',kind:'explain',title:'Safety',objective:'Retry safety',relevance:'Review',body:'A payment may already have succeeded.',hook:'Review safe retries for payments'},sourceIds:[]},reason:'Explain'}),usage:{input:20,output:20}})}});
 try{await e.load();await e.command({action:'enable'});e.session('prior').evidence=[{id:'old',momentId:'old',objective:'Retry safety',project:'payments',verdict:'correct',createdAt:'2025-01-01T00:00:00Z'}];await e.openSession('w',{project:'payments'});await assert.rejects(e.command({action:'start-review',sessionID:'w'}),/retrieval/);assert.ok(e.session('w').reviewOffer);assert.equal(e.session('w').moment,null);
 }finally{clear(e);}
});
test('generic filtered proposals stay silent, never an empty goal screen',async()=>{
 const e=make({gateway:{generate:async()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:[{...goal,outcome:'Understand this code'}]},reason:'Generic'}),usage:{input:20,output:20}})}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'t',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});await e.consider('w');assert.equal(e.session('w').goals,null);assert.equal(e.session('w').phase,'observing');assert.equal(e.session('w').firstOfferAt,null);
 }finally{clear(e);}
});
test('late host model selection does not consume the initial task opportunity',async()=>{
 let calls=0;const e=make({defaultLearningModel:null,debounceMs:5,capabilities:{...caps,observation:{kinds:[...caps.observation.kinds,'model.selected']}},gateway:{generate:async()=>{calls++;return result();}}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'task',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});await e.consider('w');assert.equal(calls,0);assert.equal(e.session('w').automaticChecksThisTask??0,0);assert.equal(e.session('w').phase,'no-model');
 await e.onWorkEvent({id:'model',sessionId:'w',type:'model.selected',data:{model:{providerID:'native',modelID:'connected'}}});for(let n=0;n<50&&!e.session('w').goals;n++)await new Promise(r=>setTimeout(r,5));assert.equal(calls,1);assert.ok(e.session('w').goals.list.length);
 }finally{clear(e);}
});

test('automatic call budget survives new prompts and only meaningful events spend another check',async()=>{
 let ms=Date.parse('2026-11-03T12:00:00Z'),calls=0;const e=make({now:()=>new Date(ms).toISOString(),automaticMinIntervalMs:120000,maxAutomaticChecksPerWindow:3,automaticWindowMs:600000,gateway:{generate:async()=>{calls++;return result();}}});
 const task=async id=>e.onWorkEvent({id,sessionId:'w',type:'task.submitted',data:{text:'Build retry handling '+id}});
 try{await e.load();await e.command({action:'enable'});await task('a');await e.consider('w');assert.equal(calls,1);
 await task('b');await e.consider('w');assert.equal(calls,1,'a new coding message cannot reset the cost gate');
 ms+=120001;await e.onWorkEvent({id:'edit',sessionId:'w',type:'file.changed',data:{path:'retry.ts',diff:'+ cancellation'}});await e.consider('w');assert.equal(calls,2);
 ms+=120001;await task('c');await e.consider('w');assert.equal(calls,3);
 ms+=120001;await task('d');await e.consider('w');assert.equal(calls,3,'three automatic checks exhaust the rolling window');
 }finally{clear(e)}
});

test('automatic budgets persist across process restarts and off/on',async()=>{
 let stored,ms=Date.parse('2026-11-03T12:00:00Z'),calls=0;
 const storage={get:async()=>stored,set:async(_,value)=>{stored=structuredClone(value);}};
 const options={storage,now:()=>new Date(ms).toISOString(),automaticMinIntervalMs:120000,maxAutomaticChecksPerWindow:3,gateway:{generate:async()=>{calls++;return result();}}};
 const e=make(options);let restarted;
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'a',sessionId:'w',type:'task.submitted',data:{text:'Build retry cancellation'}});await e.consider('w');assert.equal(calls,1);
 restarted=make(options);await restarted.load();await restarted.command({action:'enable'});await restarted.onWorkEvent({id:'b',sessionId:'w',type:'task.submitted',data:{text:'Now add a cache'}});await restarted.consider('w');assert.equal(calls,1);
 }finally{clear(e);if(restarted)clear(restarted)}
});

test('one malformed-reply repair counts toward the same automatic call budget',async()=>{
 let calls=0;const e=make({automaticMinIntervalMs:120000,maxAutomaticChecksPerWindow:3,maxGoalRequests:2,gateway:{generate:async()=>{calls++;return calls===1?{text:'',usage:{input:20,output:1}}:result();}}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'t',sessionId:'w',type:'task.submitted',data:{text:'Build a retry helper'}});await e.consider('w');assert.equal(calls,2);assert.equal(e.session('w').automaticCheckTimes.length,2);assert(e.session('w').goals.list.length);}
 finally{clear(e)}
});
test('a captured coding opening can start learning after a terse later message without repeated acknowledgement spending',async()=>{
 let calls=0;const e=make({gateway:{generate:async()=>{calls++;return result();}}});
 try{
  await e.load();await e.command({action:'enable'});await e.openSession('w',{codingOpening:{id:'opening',text:'Understand how the sidecar architecture observes coding sessions'}});
  await e.onWorkEvent({id:'ack',sessionId:'w',type:'task.submitted',data:{text:'Okay'}});await e.consider('w');assert.equal(calls,1);
  await e.onWorkEvent({id:'ack2',sessionId:'w',type:'task.submitted',data:{text:'Thanks'}});await e.consider('w');assert.equal(calls,1);
 }finally{clear(e);}
});

import {CodexLearningGateway} from '../../../adapters/codex/src/model-gateway.js';
import {ClaudeLearningGateway} from '../../../adapters/claude/src/host.js';
for(const [host,gateway]of [['codex',new CodexLearningGateway({rpc:null,directory:'/synthetic',models:[{model:'fast',description:'Fast and affordable'},{model:'small',isDefault:true}]})],['claude',new ClaudeLearningGateway({directory:'/synthetic'})]])test(`${host} default opportunity selection uses the chosen teaching model while explicit routing wins`,async()=>{
 const models=[];const e=make({gateway:{defaultContextModel:gateway.defaultContextModel,generate:async input=>{models.push(input.model.modelID);return result();}}});
 try{await e.load();await e.command({action:'enable'});await e.onWorkEvent({id:'task',sessionId:'w',type:'task.submitted',data:{text:'Build an HTTP retry helper'}});await e.consider('w');assert.deepEqual(models,['small']);
 await e.command({action:'set-context-model',value:{providerID:'native',modelID:'preferred'}});await e.command({action:'suggest',sessionID:'w'});assert.deepEqual(models,['small','preferred']);
 }finally{clear(e);}
});
