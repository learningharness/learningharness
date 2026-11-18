import {journeyFixture} from './journey-fixture.js';
import test from 'node:test';import assert from 'node:assert/strict';import {LearningEngine,nextMoves} from '../src/learning-engine.js';
const design={version:1,newAbility:'Distinguish partial reads from lost updates',distinction:{left:'Atomic replacement',right:'Serializing read-modify-write'},addsBeyond:'Predict the result of overlapping writers.',capability:'predict',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
const target={id:'saved',kind:'goal',goal:{kind:'core',minutes:3,outcome:'Why concurrent writes lose data',whyNow:'Your reading queue stores JSON',insight:'Two writers can read the same old value, then overwrite each other’s updates.',path:['Read','Write']},snapshot:[{id:'original',type:'task.submitted',data:{text:'Original reading queue task'}}]};
test('clicking an invitation starts teaching and a probe, without a second lesson gate',async()=>{
 let calls=0,prompt;const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async input=>{calls++;prompt=input.prompt;return{text:JSON.stringify({tool:'present',input:{experience:{lesson:{journey:journeyFixture(target.goal.outcome),sections:[{title:'Two writers, one old list',body:'Both writers can read the same starting list before either replaces it.'},{title:'Give each append its predecessor',body:'Serialize the complete read-modify-write sequence so the second append reads the first result.'}],takeaway:'Atomic replacement prevents partial reads; serialization prevents lost updates.'},learningDesign:design,decision:'offer',kind:'explain',title:target.goal.outcome,objective:target.goal.outcome,relevance:target.goal.whyNow,body:'Serialize the whole read-modify-write sequence so each append sees the preceding result. Atomic replacement alone only prevents partial reads.',question:'If two writers read the same list before either writes, which update can be lost?',rubric:'Recognize that the last replacement can omit the other append.',hook:'Explore why concurrent JSON writers lose updates'},sourceIds:['original']},reason:'Learner started the lesson'})};}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}}});
 await e.load();await e.command({action:'enable'});const s=e.session('chat');s.goals={id:'new',list:[{outcome:'A different current topic'}]};
 await e.prepareOpportunity('chat',target);
 assert.equal(s.moment,null);assert.equal(e.snapshot('chat').session.preparedLessons,undefined);
 const preparedCalls=calls;await e.openPreparedOpportunity('chat',target);assert.equal(calls,preparedCalls);
 assert.equal(s.moment.objective,target.goal.outcome);assert.ok(s.moment.question);assert.equal(s.moment.orientation,false);assert.equal(s.moment.snapshot[0].id,'original');assert.equal(calls,1);assert.match(prompt,/PREBUILD/);assert.ok(!nextMoves(s).some(m=>m.id==='start-lesson'));
 assert.equal(e.snapshot('chat').session.moment.rubric,undefined);
 s.draft={answer:'Keep this answer'};await e.openPreparedOpportunity('chat',target);assert.equal(s.draft.answer,'Keep this answer');assert.equal(calls,1);
 assert.equal(e.session('other').moment,null);await assert.rejects(e.openPreparedOpportunity('other',undefined),/older invitation/);
 const active=s.moment.id,another={...target,id:'another'};await e.prepareOpportunity('chat',another);
 assert.equal(calls,1,'identical prebuild under another invitation must reuse saved content');
 assert.equal(s.moment.id,active,'background preparation must not replace active learning');assert.equal(s.draft.answer,'Keep this answer');
 const ready={id:'foreground-invitation',kind:'moment',momentId:s.moment.id,title:s.moment.title};
 await e.prepareOpportunity('chat',ready);await e.openPreparedOpportunity('chat',ready);assert.equal(s.draft.answer,'Keep this answer');assert.equal(calls,1,'publishing newly ready content never regenerates it');
 await e.prepareOpportunity('chat',{...target,id:'different-work',snapshot:[{id:'original',type:'task.submitted',data:{text:'Changed work'}}]});assert.equal(calls,2,'changed grounding needs a fresh lesson');
 await e.command({action:'save-learner-profile',value:{goals:['Understand concurrency'],known:['Already comfortable with basic writer serialization'],preferences:'Boundary cases'}});
 await e.prepareOpportunity('chat',{...target,id:'changed-learner'});assert.equal(calls,3,'changed learner evidence must not reuse an old novice preparation');
 await e.command({action:'disable'});await assert.rejects(e.prepareOpportunity('chat',{...target,id:'off'}),/Off/);assert.equal(s.preparedLessons.off,undefined);
});

for(const preserveOtherFault of [false,true])test(`successful background preparation clears its previous error${preserveOtherFault?' without clearing another chat error':''}`,async()=>{
 let calls=0;
 const envelope={tool:'present',input:{experience:{decision:'offer',kind:'explain',title:target.goal.outcome,objective:target.goal.outcome,relevance:target.goal.whyNow,body:'Serialize the entire read-modify-write operation, not only the replacement.',hook:'See why an atomic replacement can still lose an append.',question:'Can an atomic replacement alone keep both overlapping appends?',rubric:'No; the read-modify-write operations must be serialized.',learningDesign:design,lesson:{journey:journeyFixture(target.goal.outcome),sections:[{title:'Both read the same list',body:'Two appends can read the same initial list before either replaces it.'},{title:'Coordinate the complete operation',body:'Serializing read, modification and replacement lets the second operation see the first append.'}],takeaway:'Atomic replacement protects visibility; serialization protects updates.'}},sourceIds:['original']},reason:'Prepare the useful distinction'};
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{if(++calls===1)throw Error('Synthetic provider format failure');return{text:JSON.stringify(envelope)};}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}}});
 await e.load();await e.command({action:'enable'});
 await assert.rejects(e.prepareOpportunity('chat',target),/format failure/);
 await e.fail(Error('Synthetic provider format failure'),'chat');
 const firstError=e.snapshot('chat').session.fault;assert.ok(firstError);
 if(preserveOtherFault)await e.fail(Error('Another chat needs recovery'),'other');
 await e.prepareOpportunity('chat',target);
 assert.ok(e.session('chat').preparedLessons.saved);
 assert.equal(e.snapshot('chat').session.fault,null,'the ready lesson must not retain the failed preparation banner');
 assert.equal(e.state.fault?.sessionID,preserveOtherFault?'other':undefined,'recovery belongs to this exact chat');
 // A cached lesson can also be opened after a later unsuccessful request.
 await e.fail(Error('Another attempt failed'),'chat');
 const beforeOpen=calls;await e.openPreparedOpportunity('chat',target);
 assert.equal(calls,beforeOpen,'opening prepared teaching stays local');
 assert.equal(e.snapshot('chat').session.fault,null,'cached activation replaces its previous failure');
 assert.equal(e.state.fault,null);
});
