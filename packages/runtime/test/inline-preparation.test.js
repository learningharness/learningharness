import test from 'node:test';import assert from 'node:assert/strict';
import {preparationPrompt} from '../src/preparation-prompt.js';
import {LearningEngine} from '../src/learning-engine.js';
const goal={outcome:'Predict retry behavior'};
test('inline-enabled preparation offers bounded questions without forcing a lesson journey',()=>{
 const p=preparationPrompt({goal,trace:[],allowInline:true,planJourney:true});
 assert.match(p,/QUICK OR FULL/);assert.match(p,/present.*predict/s);assert.match(p,/Only for a full lesson/);
});
test('disabled inline preserves full lesson preparation',()=>{
 const p=preparationPrompt({goal,trace:[],allowInline:false,planJourney:true});assert.doesNotMatch(p,/QUICK OR FULL/);assert.match(p,/Use teach with lesson/);
});
test('prepared short questions can open without a lesson and retain the same moment',async()=>{
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{throw Error('Must not generate on reopen')}},capabilities:{host:'fixture',model:{},observation:{kinds:[]},surface:{}}});await e.load();await e.command({action:'enable'});
 const moment={id:'short',kind:'predict',objective:goal.outcome,title:'Retry',body:'A failed load is removed.',question:'What happens on retry?',rubric:'A fresh load starts.',snapshot:[],sourceIds:[]};e.session('chat').preparedLessons={saved:{goal,moment}};
 e.preparedOpportunityCurrent=()=>true;
 await e.openPreparedOpportunity('chat',{id:'saved',kind:'goal'});assert.equal(e.session('chat').moment.id,'short');
});
test('normal prepared generation accepts a bounded prediction, with full lesson still available',async()=>{
 const design={version:1,newAbility:'Predict a retry after a rejected load',distinction:{left:'Sharing a pending promise',right:'Retaining a rejected promise'},addsBeyond:'Predict a changed failure and retry sequence.',capability:'predict',approach:'contrast_then_explain',basis:{kind:'unknown',evidenceIds:[]}};
 const experience={decision:'offer',kind:'predict',title:'A fresh retry',objective:goal.outcome,relevance:'Retry after load failure',body:'The cache deletes its pending entry when a load rejects.',question:'After the rejection, does another caller start a new load?',rubric:'Yes. The failed entry was removed.',hook:'Predict the next retry',learningDesign:design};
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>({text:JSON.stringify({tool:'present',reason:'One bounded prediction is enough',input:{experience,sourceIds:[]}})})},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',model:{independent:true},observation:{kinds:[]},surface:{}}});await e.load();await e.command({action:'enable'});
 const m=await e.generateMoment('chat',{goal,prepareOnly:true,planJourney:true,requireTeachingProbe:true});assert.equal(m.kind,'predict');assert.equal(m.lesson,undefined);assert.equal(e.session('chat').moment,null);
});
