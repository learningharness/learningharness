import test from 'node:test';import assert from 'node:assert/strict';
import {mechanics,parseJudgment,dimensions} from '../../../scripts/evals/rubric.mjs';
import {examples} from '../../../scripts/evals/cases.mjs';
import {parseGoals} from '../src/learning-engine.js';
import {explanationRequest,workloadContext,observeWorkload} from '../../learning/src/tutoring-policy.js';
const result=()=>({tool:'record_eval',input:{examples:examples.map(e=>({id:e.id,classification:e.expected})),cases:[{id:'c',scores:Object.fromEntries(dimensions.map(d=>[d,2])),issues:[],passed:true}]}});
test('eval separates slow/failed runtime from polished learning content',()=>{
 const samples=[{elapsedMs:10,observedTaskAt:10,state:{}},{elapsedMs:16011,observedTaskAt:10,state:{session:{goals:{list:[{outcome:'Useful goal'}]}}}}];
 const grade=mechanics({samples,mainStatus:'completed',mode:'live',usage:{calls:1,input:1,output:1}});assert.equal(grade.passed,false);assert.equal(grade.firstOfferMs,16001);assert.match(grade.failures[0],/15 seconds/);
});
test('judge cannot override failed scores and must pass all human calibration anchors',()=>{
 const raw=result();raw.input.cases[0].scores.non_policing=0;const parsed=parseJudgment(JSON.stringify(raw),['c'],examples);assert.equal(parsed.cases[0].passed,false);assert.equal(parsed.calibrated,true);
 raw.input.examples.find(e=>e.id==='own-context').classification='good';assert.equal(parseJudgment(JSON.stringify(raw),['c'],examples).calibrated,false);
 raw.input.cases=[];assert.throws(()=>parseJudgment(JSON.stringify(raw),['c'],examples),/omitted/);
});
test('context request is a validated proposal, not an instruction to the coding agent',()=>{
 const parsed=parseGoals(JSON.stringify({decision:'offer',goals:[{kind:'core',outcome:'How cache and storage fit',whyNow:'This matches your architecture goal',minutes:3,contextNeeded:true}]}));assert.equal(parsed.goals[0].contextNeeded,true);assert.match(explanationRequest(parsed.goals[0]),/For my learning/);assert.match(explanationRequest(parsed.goals[0]),/not a review/);
 assert.throws(()=>parseGoals(JSON.stringify({decision:'offer',goals:[{...parsed.goals[0],contextNeeded:'send now'}]})),/boolean/);
});
test('dense work is model context, never a claim that the learner is behind',()=>{
 const session={};for(let i=0;i<4;i++)observeWorkload(session,{type:'file.changed',data:{path:`file${i}.js`}},'2026-01-01T00:00:00Z');
 assert.deepEqual(workloadContext(session,'2026-01-01T00:01:00Z'),{dense:true,recentChangedFiles:['file0.js','file1.js','file2.js','file3.js']});assert.equal(workloadContext(session,'2026-01-01T00:04:00Z').dense,false);
});
test('complete goal replies missing only the bookkeeping reason survive, executable calls remain strict',async()=>{
 const {decodeToolCall}=await import('../src/tool-call.js');
 const original={tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Retry safety',whyNow:'Your retry goal applies here',minutes:2}]}};
 const decoded=decodeToolCall(JSON.stringify(original));assert.equal(decoded.recovered,true);assert.deepEqual(decoded.choice.input,original.input);
 const executable=decodeToolCall('{"tool":"build_interactive","input":{"brief":"Retry safety"}}');assert.equal(executable.recovered,false);assert.equal(executable.choice.reason,undefined);
});
test('live mechanics fail closed for absent timing, excessive calls and unreported usage',()=>{
 const samples=[{elapsedMs:25000,observedTaskAt:null,state:{session:{goals:{list:[{outcome:'Polished but late'}]}}}}];
 const grade=mechanics({samples,mainStatus:'completed',mode:'live',usage:{input:1,output:1,calls:9,unreportedCalls:1}});assert.equal(grade.passed,false);assert.ok(grade.failures.some(s=>/measurable/.test(s)));assert.ok(grade.failures.some(s=>/budget/.test(s)));assert.ok(grade.failures.some(s=>/unreported/.test(s)));
});
test('a recorded request cannot pass as zero settled calls or zero accounted usage',()=>{
 const samples=[{elapsedMs:1,observedTaskAt:1,state:{}},{elapsedMs:100,observedTaskAt:1,state:{session:{goals:{list:[{}]}}}}];
 for(const usage of [{calls:0,input:0,output:0},{calls:2,input:0,output:0}])assert.equal(mechanics({samples,mainStatus:'completed',mode:'live',requestCount:2,usage}).passed,false);
});
