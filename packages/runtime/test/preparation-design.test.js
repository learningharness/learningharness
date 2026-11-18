import test from 'node:test';import assert from 'node:assert/strict';
import {preparationPrompt} from '../src/preparation-prompt.js';import {validateContrast} from '../../experiences/src/contrast.js';
test('preparation provides one bounded evidence packet and asks for incremental learner value without fixed subjects',()=>{
 const p=preparationPrompt({goal:{outcome:'Distinguish shrinkability from minimum size'},trace:[{id:'task',type:'task.submitted',data:{text:'FIXED_MARKER'}}]});assert.equal(p.split('FIXED_MARKER').length-1,1);assert.match(p,/addsBeyond/);assert.match(p,/expertise is topic-specific/i);assert.match(p,/not verified transfer/i);assert.ok(p.length<4100);assert.doesNotMatch(p,/Use build_interactive and present/);
});
test('contrast formats carry bounded plain cases and reject invented extra fields',()=>{
 const c={varied:'Minimum size',cases:[{label:'Automatic',situation:'min-width:auto',result:'Does not shrink below content minimum'},{label:'Zero',situation:'min-width:0',result:'Can shrink below content minimum'}]};assert.equal(validateContrast(c).cases.length,2);assert.throws(()=>validateContrast({...c,html:'<script>'}),/unknown/);assert.throws(()=>validateContrast({...c,cases:[c.cases[0],c.cases[0]]}),/differ/);
});
import {createLearningTools} from '../src/learning-tools.js';import {parseExperience} from '../src/learning-engine.js';import {publicLearningMoment} from '../../experiences/src/flashcard-deck.js';
const design={version:1,newAbility:'Predict a different minimum-size constraint',distinction:{left:'Ability to shrink',right:'Minimum size allowed'},addsBeyond:'Compare an otherwise identical item with zero minimum.',capability:'predict',approach:'contrast_then_explain',basis:{kind:'unknown',evidenceIds:[]}};
test('prepared registry requires a design but keeps subject content open, and hides the internal hypothesis',async()=>{
 const registry=createLearningTools({intent:'moment',preparing:true,work:[{id:'task'}],learner:[],goal:{outcome:'CSS minimum sizing'},validateExperience:x=>parseExperience(JSON.stringify(x))});
 assert.ok(!registry.describe().some(t=>t.name==='create_question'));assert.ok(registry.describe().some(t=>t.name==='teach'));
 const experience={decision:'offer',kind:'explain',title:'Why shrink does not remove a minimum',objective:'CSS minimum sizing',body:'Shrink distributes negative free space, but a minimum size can still clamp the result.',question:'Which constraint should change if an item may shrink below its content minimum?',rubric:'Distinguish the minimum from flex-shrink.',hook:'Compare the minimum-size constraint'};
 await assert.rejects(registry.execute({tool:'present',reason:'Teach a distinction',input:{experience,sourceIds:['task']}},{check:()=>{}}),/learningDesign/);
 const done=await registry.execute({tool:'present',reason:'Teach a distinction',input:{experience:{...experience,learningDesign:design},sourceIds:['task']}},{check:()=>{}});
 assert.equal(done.value.experience.learningDesign.capability,'predict');assert.equal(publicLearningMoment(done.value.experience).learningDesign,undefined);assert.equal(publicLearningMoment(done.value.experience).rubric,undefined);
});
import {LearningEngine} from '../src/learning-engine.js';
test('contrast explanation is available immediately, recorded once and requires no inference',async()=>{
 let calls=0;const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{calls++;throw Error('No generation allowed')}},capabilities:{host:'fixture',model:{},observation:{kinds:[]},surface:{}}});await e.load();await e.command({action:'enable'});e.session('chat').moment={id:'m',kind:'explain',comparison:{},learningDesign:design};
 await e.command({action:'reveal-explanation',sessionID:'chat'});await e.command({action:'reveal-explanation',sessionID:'chat'});await assert.rejects(e.command({action:'reveal-explanation',sessionID:'chat',expectedMomentId:'stale'}),/changed/);assert.equal(calls,0);assert.equal(e.session('chat').moment.explanationRevealed,true);assert.equal(e.session('chat').moment.assistance.length,1);assert.equal(e.snapshot('chat').session.moment.learningDesign,undefined);
});
import {compactToolGuidance} from '../src/tool-registry.js';
test('compact preparation contracts retain field bounds, optional markers and exact runtime validation',()=>{
 const registry=createLearningTools({intent:'moment',preparing:true,work:[],learner:[],validateExperience:x=>x});const tools=registry.describe();const compact=compactToolGuidance(tools);assert.match(compact,/body:string\[1\.\.280\]/);assert.match(compact,/comparison\?:/);assert.match(compact,/array\[2\.\.2\]/);assert.match(compact,/question:string\[1\.\.200\]/);assert.ok(compact.length<JSON.stringify(tools).length*.7);assert.throws(()=>registry.prepareInput('teach',{}),/missing/);
});
test('an explicit explanation request bypasses contrast-first presentation and requires no diagnostic quiz',async()=>{
 const comparison={varied:'Minimum size',cases:[{label:'Automatic minimum',situation:'Same row and word, min-width:auto',result:'The minimum can clamp shrinking'},{label:'Zero minimum',situation:'Same row and word, min-width:0',result:'The item can shrink further'}]};
 const goal={outcome:'CSS minimum sizing'};const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>({text:JSON.stringify({tool:'present',reason:'Answer the explicit explanation request',input:{experience:{decision:'offer',kind:'explain',title:'A minimum clamps shrink',objective:goal.outcome,body:'The shrink factor distributes a deficit; it does not override a minimum size.',hook:'Compare minimum size and shrink allocation',comparison,learningDesign:design},sourceIds:[]}})})},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{}}});await e.load();await e.command({action:'enable'});const moment=await e.generateMoment('chat',{goal,request:'Explain this directly; no quiz.'});assert.equal(moment.comparisonFirst,false);assert.equal(moment.question,'');assert.match(moment.body,/minimum/);
});
