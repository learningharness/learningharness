import test from 'node:test';import assert from 'node:assert/strict';
import {validateJourneyPlan} from '../../experiences/src/journey-plan.js';
import {attachJourney,saveJourneyStage,publicJourneys} from '../src/work-journey.js';
import {LearningEngine} from '../src/learning-engine.js';
const plan={destination:'Independently protect cache ownership across invalidation',steps:[{objective:'Explain the current token guard',purpose:'Separate caller delivery from cache ownership',mode:'lesson'},{objective:'Trace an old rejection after replacement',purpose:'Judge a changed failure-cleanup contract',mode:'decision'},{objective:'Design a race test that detects a missing guard',purpose:'Apply the invariant to an unworked ordering',mode:'practice'}]};
test('journey plans are bounded and tied to the selected starting objective',()=>{
 assert.deepEqual(validateJourneyPlan(plan,plan.steps[0].objective),plan);
 assert.throws(()=>validateJourneyPlan(plan,'An unrelated objective'));
 assert.throws(()=>validateJourneyPlan({...plan,steps:plan.steps.slice(0,2)}));
 assert.throws(()=>validateJourneyPlan({...plan,steps:plan.steps.map(s=>({...s,mode:'lesson'}))}));
 assert.throws(()=>validateJourneyPlan({...plan,steps:[plan.steps[0],plan.steps[0],plan.steps[2]]}));
});
const design={version:1,newAbility:'Reason about cache ownership',distinction:{left:'Caller delivery',right:'Cache ownership'},addsBeyond:'An unworked failure ordering',capability:'explain',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
async function fixture(){
 let calls=0;const prompts=[];let stored;
 const engine=new LearningEngine({storage:{get:async()=>stored??null,set:async(_,value)=>{stored=value;}},capabilities:{host:'fixture',model:{independent:true},observation:{kinds:[]},surface:{}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},gateway:{generate:async input=>{calls++;prompts.push(input.prompt);return{text:JSON.stringify({tool:'teach',reason:'Teach the requested stage',input:{title:'Failure cleanup still needs ownership',objective:JSON.parse(input.prompt.match(/SELECTED GOAL \(untrusted data\):([^\n]+)/)[1]).outcome,relevance:'Original cache work',body:'Only the current owner can change shared state.',lesson:{sections:[{title:'The original caller',body:'Its old promise still rejects.'},{title:'The replacement',body:'It keeps the current token.'}],takeaway:'Promise delivery and map ownership are separate.'},learningDesign:design,question:'How would unconditional cleanup change the result?',rubric:'It would erase the replacement.',hook:'An old cache error must preserve the new owner',sourceIds:['task']}}),usage:{input:30,output:30}};}}});
 await engine.load();await engine.command({action:'enable'});const s=engine.session('original');s.context={project:'/cache',title:'Cache build'};
 const moment={id:'first',objective:plan.steps[0].objective,lesson:{journey:plan},snapshot:[{id:'task',type:'task.submitted',data:{text:'Original cache work'}}],createdAt:'2026-11-10T00:00:00Z',assistance:[]};
 await engine.activateMoment('original',moment,{outcome:moment.objective});
 return{engine,ref:moment.journey,prompts,calls:()=>calls,stored:()=>stored};
}
test('connected steps preserve sources across sessions and reopen exact cached work without inference',async()=>{
 const f=await fixture(),{engine,ref}=f;engine.session('other').context={project:'/ui',title:'UNRELATED_TASK'};
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:1}});
 assert.equal(f.calls(),1);const s=engine.session('other');assert.equal(s.moment.objective,plan.steps[1].objective);assert.equal(s.moment.learningContext.project,'/cache');assert.equal(s.context.project,'/ui');assert.equal(s.moment.snapshot[0].id,'task');
 s.hint={text:'A hint already used'};s.draft={answer:'saved reasoning'};s.moment.assistance=[{kind:'hint'}];s.feedback={verdict:'partial',answer:'prior answer'};s.moment.completed=true;await engine.persist();
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:0}});
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:1}});
 assert.equal(f.calls(),1);assert.equal(s.feedback.answer,'prior answer');assert.equal(s.hint.text,'A hint already used');assert.equal(s.draft.answer,'saved reasoning');assert.equal(s.moment.completed,true);
 assert(!JSON.stringify(engine.snapshot('other').journeys).includes('rubric'));
 await engine.command({action:'disable'});await assert.rejects(engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:2}}),/Turn learning on/);assert.equal(f.calls(),1);
});
test('journey navigation rejects out-of-range and stale requests without spending tokens',async()=>{
 const {engine,ref,calls}=await fixture();
 for(const index of [-1,4,1.2,'1'])await assert.rejects(engine.command({action:'journey-step',sessionID:'original',value:{id:ref.id,index}}));
 await assert.rejects(engine.command({action:'journey-step',sessionID:'original',value:{id:ref.id,index:1},expectedMomentId:'stale'}),/changed/);assert.equal(calls(),0);
});
test('opening a journey elsewhere prevents the older view from changing saved practice',async()=>{
 const {engine,ref,calls}=await fixture();
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:0}});
 await assert.rejects(engine.command({action:'save-draft',sessionID:'original',value:{momentId:'first',answer:'stale answer',choice:''}}),/another chat/);
 await assert.rejects(engine.command({action:'hint',sessionID:'original'}),/another chat/);
 assert.equal(calls(),0);assert.equal(engine.state.journeys[ref.id].stages[0].draft,null);
});
test('repeated activation of the same prepared first lesson reuses its journey identity',async()=>{
 const {engine,ref}=await fixture(),first=structuredClone(engine.session('original').moment);delete first.journey;
 const session=engine.session('original');session.feedback={verdict:'partial',answer:'Keep my answer'};session.hint={text:'Keep my help'};session.draft={answer:'Keep my draft'};await engine.persist();
 await engine.activateMoment('original',first,{outcome:first.objective});
 assert.equal(engine.session('original').moment.journey.id,ref.id);assert.equal(Object.keys(engine.state.journeys).length,1);
 assert.equal(session.feedback.answer,'Keep my answer');assert.equal(session.hint.text,'Keep my help');assert.equal(session.draft.answer,'Keep my draft');
});
test('a delayed journey-derived exploration cannot reclaim ownership after another chat opens it',async()=>{
 const {engine,ref}=await fixture();const original=engine.session('original');original.moment.deeper='Trace failure cleanup';
 let release,started;const entered=new Promise(resolve=>started=resolve),generate=engine.gateway.generate;
 engine.gateway.generate=async input=>{started();await new Promise(resolve=>release=resolve);const response=await generate(input),json=JSON.parse(response.text);json.input.objective=original.moment.objective;response.text=JSON.stringify(json);return response;};
 const pending=engine.command({action:'next-move',sessionID:'original',value:'dig-deeper'});await entered;
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:0}});
 await engine.command({action:'save-draft',sessionID:'other',value:{momentId:'first',answer:'New owner draft',choice:''}});release();
 await assert.rejects(pending,/another chat|stale/);assert.equal(engine.state.journeys[ref.id].ownerSessionID,'other');assert.equal(engine.state.journeys[ref.id].stages[0].draft.answer,'New owner draft');
});
test('first lesson retains original provenance when reopened into unrelated work',async()=>{
 const {engine,ref}=await fixture();engine.session('other').context={project:'/unrelated',title:'Unrelated work'};
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:0}});
 assert.equal(engine.session('other').moment.learningContext.project,'/cache');assert.equal(engine.session('original').moment.learningContext.project,'/cache');
});
test('a stale target view cannot overwrite the latest saved stage during ownership transfer',async()=>{
 const {engine,ref}=await fixture();await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:0}});
 await engine.command({action:'journey-step',sessionID:'original',value:{id:ref.id,index:0}});
 const current=engine.session('original');current.hint={text:'Latest help'};current.feedback={verdict:'partial',answer:'Latest answer'};await engine.persist();
 await engine.command({action:'journey-step',sessionID:'other',value:{id:ref.id,index:1}});
 assert.equal(engine.state.journeys[ref.id].stages[0].feedback.answer,'Latest answer');assert.equal(engine.state.journeys[ref.id].stages[0].hint.text,'Latest help');
});
test('journey activation freezes source origin, persists exact assistance, and exposes no private content',()=>{
 const state={sessions:{work:{id:'work',context:{project:'/cache',title:'Cache work'}}}};
 const moment={id:'m1',objective:plan.steps[0].objective,lesson:{journey:plan},snapshot:[{id:'src',data:{text:'original code'}}],rubric:'PRIVATE',assistance:[],createdAt:'2026-11-10T00:00:00Z'};
 attachJourney(state,'work',moment);assert(moment.journey.id);assert.equal(Object.keys(state.journeys).length,1);
 const session=state.sessions.work;session.moment=moment;session.feedback={verdict:'correct',evidenceLabel:'practiced_with_assistance',answer:'my answer'};session.hint={text:'Help used'};session.draft={answer:'draft'};
 saveJourneyStage(state,session);moment.snapshot[0].data.text='mutated';
 const record=state.journeys[moment.journey.id];assert.equal(record.snapshot[0].data.text,'original code');assert.deepEqual(record.stages[0].feedback,session.feedback);assert.deepEqual(record.stages[0].hint,session.hint);
 const publicValue=publicJourneys(state);assert.equal(publicValue[0].steps[0].status,'Practised with help');assert.equal(publicValue[0].steps[1].status,'Not opened');assert(!JSON.stringify(publicValue).includes('PRIVATE'));assert(!JSON.stringify(publicValue).includes('original code'));assert(!JSON.stringify(publicValue).includes('my answer'));
 session.feedback=null;saveJourneyStage(state,session);assert.equal(publicJourneys(state)[0].steps[0].status,'Opened');
});
