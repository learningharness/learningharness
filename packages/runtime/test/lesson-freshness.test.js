import {journeyFixture} from './journey-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const task={id:'task',type:'task.submitted',sessionId:'chat',data:{text:'Implement token-guarded cache invalidation'}};
const goal={kind:'core',outcome:'Trace token ownership',whyNow:'The cache can settle after invalidation.',minutes:2,insight:'The current token decides which callback can change shared state.'};
const target={id:'prepared',kind:'goal',goal,snapshot:[{id:task.id,type:task.type,data:task.data}]};
const design={version:1,newAbility:'Predict stale cleanup',distinction:{left:'Old callback',right:'Current owner'},addsBeyond:'Trace ownership after invalidation.',capability:'predict',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
const reply=()=>({text:JSON.stringify({tool:'present',reason:'Teach the selected mechanism',input:{sourceIds:['task'],experience:{decision:'offer',kind:'explain',title:'Ownership outlasts completion order',objective:goal.outcome,body:'Only the current token can change shared state.',question:'Does finishing last restore ownership?',rubric:'No, compare token identity.',hook:'Trace stale cleanup after invalidation',learningDesign:design,lesson:{journey:journeyFixture(goal.outcome),sections:[{title:'Separate the two outcomes',body:'A caller can receive a value without permission to cache it.'},{title:'Trace one invalidation',body:'Removing the token stops its later callback from changing the shared entry.'}],takeaway:'Completion is not ownership.'}}}})});
async function setup(t,generate){const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},proactiveFollowup:true,debounceMs:60000,capabilities:{host:'fixture',observation:{kinds:['task.submitted','file.changed']},model:{independent:true},surface:{}}});await engine.load();await engine.command({action:'enable'});await engine.onWorkEvent(task);engine.session('chat').goals={id:'goals',list:[goal],snapshot:structuredClone(target.snapshot)};t.after(()=>{for(const timer of engine.parallelTimers.values())clearTimeout(timer);});return engine;}
test('direct angle selection cannot activate a lesson if same-task code arrives during generation',async t=>{
 let release,started;const entered=new Promise(resolve=>started=resolve);const engine=await setup(t,async()=>{started();return new Promise(resolve=>release=()=>resolve(reply()));});
 const pending=engine.command({action:'select-goal',sessionID:'chat',value:0});await entered;
 await engine.onWorkEvent({id:'new-code',type:'file.changed',sessionId:'chat',data:{path:'cache.js',content:'if (inflight.get(key) === token) inflight.delete(key);'}});release();
 await assert.rejects(pending,/work changed/i);assert.equal(engine.session('chat').moment,null);
});
test('prepared readiness and opening reject changed learner focus or profile without generating on open',async t=>{
 for(const action of ['set-session-focus','save-learner-profile']){let calls=0;const engine=await setup(t,async()=>{calls++;return reply();});await engine.prepareOpportunity('chat',target);assert.equal(engine.preparedOpportunityCurrent('chat',target),true);
 await engine.command({action,sessionID:'chat',value:action==='set-session-focus'?'Understand the actual rejection handler':{goals:['Cache tradeoffs'],known:['Already understand token guards'],preferences:'Skip the same example'}});
 assert.equal(engine.preparedOpportunityCurrent('chat',target),false);await assert.rejects(engine.openPreparedOpportunity('chat',target),/changed|context/i);assert.equal(calls,1);
 }
});

test('learner context changed during direct generation prevents old-context activation',async t=>{
 for(const action of ['set-session-focus','save-learner-profile']){let release,started;const entered=new Promise(resolve=>started=resolve);const engine=await setup(t,async()=>{started();return new Promise(resolve=>release=()=>resolve(reply()));});const pending=engine.command({action:'select-goal',sessionID:'chat',value:0});await entered;
 await engine.command({action,sessionID:'chat',value:action==='set-session-focus'?'Focus on the rejection branch':{goals:['A different cache boundary'],known:[],preferences:'Explain the tradeoff'}});release();await assert.rejects(pending,/context changed/i);assert.equal(engine.session('chat').moment,null);
 }
});
test('cached selection uses work received during learner synchronization rather than activating an older snapshot',async t=>{
 let calls=0;const engine=await setup(t,async()=>{calls++;const response=reply();if(calls>1){const value=JSON.parse(response.text);value.input.sourceIds.push('new-code');value.input.experience.lesson.sections[0].sourceIds=['new-code'];value.input.experience.lesson.sections[0].code={sourceId:'new-code',quote:'if (inflight.get(key) === token) inflight.delete(key);'};response.text=JSON.stringify(value);}return response;});await engine.prepareOpportunity('chat',target);
 const synchronize=engine.syncLearner.bind(engine);let injected=false;engine.syncLearner=async()=>{await synchronize();if(!injected){injected=true;await engine.onWorkEvent({id:'new-code',type:'file.changed',sessionId:'chat',data:{path:'cache.js',content:'if (inflight.get(key) === token) inflight.delete(key);'}});}};
 await engine.command({action:'select-goal',sessionID:'chat',value:0});assert.equal(calls,2);assert(engine.session('chat').moment.snapshot.some(source=>source.id==='new-code'));
});
test('due review preparation remains possible in a chat with observed work',async t=>{
 let calls=0;const engine=await setup(t,async()=>{calls++;const response=reply(),value=JSON.parse(response.text);value.input.sourceIds=[];value.input.experience.kind='predict';delete value.input.experience.lesson;response.text=JSON.stringify(value);return response;});
 const review={id:'review',kind:'review',review:{objective:goal.outcome,whyNow:goal.whyNow,key:'review-key'}};
 assert.equal(await engine.prepareOpportunity('chat',review),true);assert.equal(calls,1);assert.equal(engine.session('chat').preparedLessons.review.moment.lesson,undefined);
});


test('final assistant summary preserves a prepared file-grounded lesson without a second model call',async t=>{
 let release,started,calls=0;const entered=new Promise(resolve=>started=resolve);
 const engine=await setup(t,async()=>{calls++;started();return new Promise(resolve=>release=()=>{const value=JSON.parse(reply().text);value.input.sourceIds.push('stable-code');value.input.experience.lesson.sections[0].sourceIds=['stable-code'];value.input.experience.lesson.sections[0].code={sourceId:'stable-code',quote:'if (current === token) cache.set(key, value);'};resolve({text:JSON.stringify(value)});});});
 await engine.onWorkEvent({id:'stable-code',type:'file.changed',sessionId:'chat',data:{path:'cache.js',content:'if (current === token) cache.set(key, value);'}});
 const pending=engine.prepareOpportunity('chat',target);await entered;
 await engine.onWorkEvent({id:'final-summary',type:'assistant.ended',sessionId:'chat',data:{text:'Cache implementation and tests complete.'}});release();
 assert.equal(await pending,true);assert.equal(engine.preparedOpportunityCurrent('chat',target),true);
 await engine.command({action:'select-goal',sessionID:'chat',value:0});assert.equal(calls,1);assert(engine.session('chat').moment.lesson);
 assert(!engine.session('chat').moment.snapshot.some(event=>event.id==='final-summary'),'retains the exact frozen sources actually used');
});
