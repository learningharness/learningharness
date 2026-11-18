import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
import {sessionContext,rankOpportunities} from '../../learning/src/opening-context.js';

const opening='Investigate how the Claude sidecar observes coding sessions. '+ 'Context about the architecture. '.repeat(180)+'Use an interactive system diagram and authoritative developer documentation.';
const input={codingOpening:{id:'opening-user-message',text:opening},title:'Sidecar investigation'};
test('the complete coding opening survives later context updates and secret redaction',()=>{
 const first=sessionContext({...input,codingOpening:{...input.codingOpening,text:opening+' api_key=sk-abcdefghijklmnopqrstuv'}});
 assert.ok(first.codingOpening.text.includes(opening));
 assert.ok(!first.codingOpening.text.includes('sk-abcdefghijklmnopqrstuv'));
 assert.deepEqual(sessionContext({title:'Updated chat'},first).codingOpening,first.codingOpening);
 assert.deepEqual(sessionContext({codingOpening:{id:'later',text:'Different task'}},first).codingOpening,first.codingOpening);
});
test('learning calls receive the whole coding opening until explicit learner direction takes precedence',async()=>{
 const prompts=[];
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async p=>{prompts.push(p.prompt);return{text:JSON.stringify({tool:'stay_silent',input:{reason:'No new suggestion'},reason:'Nothing new'})};}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}}});
 await e.load();await e.command({action:'enable'});await e.openSession('work',input);
 await e.runLearningIntent('work',{intent:'goals',prompt:'Offer a useful learning direction'});
 assert.ok(prompts.at(-1).includes(JSON.stringify(opening)));
 const s=e.session('work');s.selectedGoal={outcome:'Learn how database indexes work'};
 await e.runLearningIntent('work',{intent:'goals',prompt:'Offer a useful learning direction'});
 assert.match(prompts.at(-1),/Learn how database indexes work/);
 assert.ok(!prompts.at(-1).includes(JSON.stringify(opening)),'the superseded long opening should not be resent');
 await e.runLearningIntent('work',{intent:'goals',prompt:'Offer a useful learning direction',learningRequest:'Explain the event hook permissions'});
 assert.match(prompts.at(-1),/\"source\":\"learner-request\",\"text\":\"Explain the event hook permissions/);
 assert.ok(!prompts.at(-1).includes(JSON.stringify(opening)));
 s.selectedGoal=null;s.learningFocus='Understand event delivery';
 await e.runLearningIntent('work',{intent:'goals',prompt:'Offer a useful learning direction'});
 assert.match(prompts.at(-1),/Understand event delivery/);
 assert.ok(!prompts.at(-1).includes(JSON.stringify(opening)));
 assert.equal(e.session('other').context?.codingOpening,undefined);
});
test('automatic ranking follows a substantive current task rather than historical opening or old selection',()=>{
 const goals=[{outcome:'Understand test output',whyNow:'A test just ran'},{outcome:'Understand the Claude sidecar architecture',whyNow:'Explain how coding sessions are observed'}];
 const session={context:sessionContext(input),workSelection:{task:{data:{text:'Understand test output'}}}};
 assert.equal(rankOpportunities(goals,session,{profile:{}})[0],goals[0]);
 session.selectedGoal={outcome:'Understand test output'};
 assert.equal(rankOpportunities(goals,session,{profile:{}})[0],goals[0]);
});

test('automatic goal calls ignore old selected lesson direction after task changes',async()=>{
 const {learningDirection}=await import('../../learning/src/opening-context.js');
 const s={context:sessionContext(input),selectedGoal:{outcome:'Readiness to learn'},workSelection:{task:{data:{text:'Fix the external toast and shortcut delivery'}}}};
 assert.equal(learningDirection(s,{ambient:true}).source,'recent-coding-task');
 assert.match(learningDirection(s,{ambient:true}).text,/toast/);
 assert.equal(learningDirection(s,{ambient:true,request:'Explain readiness'}).source,'learner-request');
 s.workSelection.task.data.text='Yes';assert.equal(learningDirection(s,{ambient:true}).source,'coding-session-opening');
});
