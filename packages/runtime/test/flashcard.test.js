import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const goal={kind:'core',outcome:'Explain retry safety',whyNow:'A request can be repeated',minutes:1};
const back='The first payment may have committed even when the response is lost.';
const call=(tool,input)=>JSON.stringify({tool,input,reason:'Recall the mechanism in this work'});
async function fixture(){
 let saved;const storage={get:async()=>structuredClone(saved),set:async(_,s)=>{saved=structuredClone(s);}};
 const gateway={generate:async({intent,prompt})=>({text:prompt.includes('LEARNING INTENT: goals')?call('suggest_goals',{goals:[goal]}):prompt.includes('LEARNING INTENT: assessment')?call('assess_answer',{verdict:'correct',feedback:'The operation can commit before the response arrives.',next:'Try a fresh case later.'}):call('present_flashcard',{title:'A lost payment reply',objective:goal.outcome,relevance:goal.whyNow,front:'Why can retrying a payment create a duplicate?',back,sourceIds:[]}),usage:{input:20,output:20}})};
 const options={storage,gateway,defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:[]},surface:{experiments:false},model:{independent:true}}};
 const e=new LearningEngine(options);await e.load();await e.command({action:'enable'});await e.command({action:'suggest',sessionID:'work'});await e.command({action:'select-goal',sessionID:'work',value:0});return {e,options};
}
test('flashcard tool stores bounded JSON and keeps its answer private until reveal',async()=>{
 const {e,options}=await fixture();const id=e.session('work').moment.id;
 assert.equal(e.session('work').moment.kind,'flashcard');assert.equal(e.snapshot('work').session.moment.answer,undefined);
 await assert.rejects(e.command({action:'reveal-card',sessionID:'work',expectedMomentId:'stale'}),/changed/);
 const snap=await e.command({action:'reveal-card',sessionID:'work',expectedMomentId:id});assert.equal(snap.session.moment.answer,back);assert.equal(snap.session.evidence.length,0);
 await e.command({action:'reveal-card',sessionID:'work',expectedMomentId:id});assert.equal(e.session('work').moment.assistance.length,1);
 const restarted=new LearningEngine(options);await restarted.load();assert.equal(restarted.session('work').moment.answer,back);assert.equal(restarted.session('work').moment.answerRevealed,true);
 await e.command({action:'submit',sessionID:'work',value:'The first payment may already have committed.'});assert.equal(e.session('work').evidence[0].assisted,true);assert.equal(e.snapshot('work').learner.reviews.length,1);
});
test('answering a flashcard before reveal records unassisted practice and exposes its back after feedback',async()=>{
 const {e}=await fixture();const snap=await e.command({action:'submit',sessionID:'work',value:'The response may be lost after commit.'});assert.equal(snap.session.evidence[0].assisted,false);assert.equal(snap.session.moment.answer,back);assert.equal(snap.session.evidence[0].evidenceLabel,'unassisted_practice');
});
