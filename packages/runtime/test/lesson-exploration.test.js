import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine,nextMoves} from '../src/learning-engine.js';
const design={version:1,newAbility:'Explain the cleanup guard',distinction:{left:'Promise delivery',right:'Map ownership'},addsBeyond:'Trace a changed rejection order.',capability:'explain',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
const lesson={sections:[{title:'An owner',body:'Only the mapped token may delete the entry.'},{title:'An old rejection',body:'An old rejection leaves a replacement mapped.'}],takeaway:'Completion does not grant ownership.'};
const moment={id:'old',kind:'explain',objective:'Explain token ownership',body:'Follow the owner.',lesson,question:'What if the old request rejects?',rubric:'It must preserve the replacement.',deeper:'Why the error handler needs the same identity guard',sibling:'How callers share a pending promise',snapshot:[{id:'task',type:'task.submitted',data:{text:'Build a promise cache'}}]};
test('a complete lesson exposes specific exploration before any quiz answer',()=>{
 const moves=nextMoves({moment});assert(moves.some(m=>m.id==='dig-deeper'));assert(moves.some(m=>m.id==='zoom-out'));
 assert(!nextMoves({moment:{...moment,deeper:'',sibling:''}}).some(m=>m.id==='dig-deeper'),'do not invent a generic paid deeper route');
});
for(const action of ['dig-deeper','zoom-out'])test(`${action} from a complete lesson teaches fully without assessment or another Start gate`,async()=>{
 let calls=0;const prompts=[];
 const nextLesson={sections:[{title:'What rejects',body:'The old promise still rejects for its existing caller.'},{title:'What stays mapped',body:'A replacement keeps its entry when the old error arrives; unconditional deletion would erase it.'}],takeaway:'Keep promise failure separate from shared-state ownership.'};
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},capabilities:{host:'fixture',model:{independent:true},observation:{kinds:[]},surface:{}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},gateway:{generate:async input=>{calls++;prompts.push(input.prompt);const goal=action==='zoom-out'?moment.sibling:moment.objective;return{text:JSON.stringify({tool:'teach',reason:'Teach the selected next mechanism',input:{title:'An error still needs an owner',objective:goal,relevance:'This is part of the same cache approach.',body:'A failure settles its caller without owning every later load.',lesson:nextLesson,learningDesign:design,question:'Why must stale rejection preserve a replacement?',rubric:'Only a matching token may delete its entry.',hook:'An old error does not own a new load',sourceIds:['task']}}),usage:{input:30,output:30}};}}});
 await engine.load();await engine.command({action:'enable'});const session=engine.session('work');session.moment=structuredClone(moment);session.selectedGoal={kind:'core',outcome:moment.objective,whyNow:'Trace current cache work',minutes:2};
 await engine.command({action:'next-move',sessionID:'work',value:action});
 assert.equal(calls,1);assert.match(prompts[0],/PREBUILD/);assert.ok(prompts[0].includes(lesson.sections[0].body));assert.ok(prompts[0].includes(lesson.takeaway));assert.deepEqual(session.moment.lesson,nextLesson);assert.notDeepEqual(session.moment.lesson,lesson);assert.equal(session.moment.entryMode,'explanation');assert.equal(session.feedback,null);assert(!nextMoves(session).some(m=>m.id==='start-lesson'));
});

test('an exploration with no new value keeps the current lesson and spends one bounded call',async()=>{
 let calls=0;const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},capabilities:{host:'fixture',model:{independent:true},observation:{kinds:[]},surface:{}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},gateway:{generate:async()=>{calls++;return{text:JSON.stringify({tool:'stay_silent',input:{reason:'No additional useful mechanism in the captured work'},reason:'Preserve the complete lesson'}),usage:{input:30,output:15}};}}});
 await engine.load();await engine.command({action:'enable'});const session=engine.session('work');session.moment=structuredClone(moment);
 await assert.rejects(engine.command({action:'next-move',sessionID:'work',value:'dig-deeper'}),/current lesson is preserved/);
 assert.equal(calls,1);assert.equal(session.moment.id,'old');assert.deepEqual(session.moment.lesson,lesson);assert.equal(engine.state.history.length,0);
});
