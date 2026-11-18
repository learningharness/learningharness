import {journeyFixture} from './journey-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';

const lesson={sections:[{title:'Two operations can start from the same state',body:'A complete update includes reading, merging and writing. If two updates read first, both can derive a replacement from the same starting state.'},{title:'Protect the complete boundary',body:'Serializing the whole operation makes the second update read the first committed result. Atomic replacement separately prevents readers from seeing a partial file.'}],takeaway:'Choose the synchronization boundary from the state transition you need to protect.'};
const design={version:1,newAbility:'Distinguish atomic replacement from serialized updates',distinction:{left:'Complete file replacement',right:'Complete update serialization'},addsBeyond:'Trace overlapping reads before either write.',capability:'predict',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
const goal={kind:'core',outcome:'Map dynamic feed tradeoffs',whyNow:'The current task balances useful content and generation cost.',minutes:3,insight:'Prepare one useful item ahead, then use engagement to decide whether another item earns its cost.'};
async function fixture(t,followup){
 let calls=0;
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async input=>({text:JSON.stringify(input.intent==='moment'?(calls++,{tool:'present',input:{experience:{lesson:{...lesson,journey:journeyFixture(goal.outcome)},learningDesign:design,decision:'offer',kind:'predict',title:'Spend ahead only when it helps',objective:goal.outcome,relevance:goal.whyNow,body:goal.insight,question:'What should happen when the learner ignores a prepared item?',rubric:'Reduce further preparation until engagement justifies it.',hook:'Explore preparation versus engagement'},sourceIds:[]},reason:'Teach the offered tradeoff'}):++calls===1?{tool:'suggest_goals',input:{goals:[goal]},reason:'Relevant tradeoff'}:followup?await followup():{tool:'stay_silent',input:{reason:'No additional useful topic'},reason:'Nothing new'})})},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},debounceMs:60000,proactiveFollowup:true,capabilities:{host:'fixture',observation:{kinds:['task.submitted','turn.started']},model:{independent:true},surface:{experiments:false}}});
 await engine.load();await engine.command({action:'enable'});
 t.after(()=>{for(const timer of engine.parallelTimers.values())clearTimeout(timer);});
 const event=(id,type,data={})=>engine.onWorkEvent({id,sessionId:'work',type,data});
 await event('first-task','task.submitted',{text:'Design a contextual learning feed'});
 await engine.consider('work');
 return {engine,event,calls:()=>calls};
}

test('a closed-panel offer remains selectable after the coding task advances and a quiet follow-up',async t=>{
 const {engine,event,calls}=await fixture(t);
 const prepared=structuredClone(engine.session('work').goals);
 assert.equal(engine.session('work').surfaceOpened,undefined);
 await event('next-task','task.submitted',{text:'Investigate a navigation bug'});
 assert.deepEqual(engine.snapshot('work').session.goals,prepared,'the invitation must still have its prepared destination before the next model response');
 await event('next-turn','turn.started');
 await engine.consider('work');
 assert.deepEqual(engine.snapshot('work').session.goals,prepared,'a silent background decision must not retract an offered destination');
 assert.equal(calls(),2);
 await engine.command({action:'surface-opened',sessionID:'work'});
 await engine.command({action:'select-goal',sessionID:'work',value:0});
 assert.equal(engine.session('work').moment.objective,goal.outcome);
 assert.deepEqual(engine.session('work').moment.snapshot,prepared.snapshot);
 assert.equal(calls(),3,'an uncached topic needs a full teaching item, not the preview insight');
 assert.equal(engine.session('other-chat').goals,null);
});

test('explicit dismissal releases a retained offer without starting another model call',async t=>{
 const {engine,event,calls}=await fixture(t);
 await event('next-task','task.submitted',{text:'Continue implementing the work'});
 assert.ok(engine.session('work').goals);
 await engine.command({action:'dismiss-opportunity',sessionID:'work'});
 assert.equal(engine.session('work').goals,null);
 assert.equal(engine.session('work').upcomingGoals,null);
 assert.equal(calls(),1);
});

test('new useful work replaces an unopened offer only after its replacement is ready',async t=>{
 let release,started;
 const pendingReply=new Promise(resolve=>{release=resolve;});
 const generating=new Promise(resolve=>{started=resolve;});
 const {engine,event,calls}=await fixture(t,()=>{started();return pendingReply;});
 const prepared=structuredClone(engine.session('work').goals);
 await event('next-task','task.submitted',{text:'Investigate a navigation bug'});
 const pending=engine.consider('work');
 await generating;
 try{assert.deepEqual(engine.snapshot('work').session.goals,prepared);}
 finally{release({tool:'suggest_goals',input:{goals:[{...goal,outcome:'Understand navigation state transitions'}]},reason:'A new useful mechanism'});}
 await pending;
 const replacement=engine.snapshot('work').session.goals;
 assert.notEqual(replacement.id,prepared.id);
 assert.equal(replacement.list[0].outcome,'Understand navigation state transitions');
 assert.equal(replacement.snapshot[0].id,'next-task');
 assert.equal(calls(),2);
});
