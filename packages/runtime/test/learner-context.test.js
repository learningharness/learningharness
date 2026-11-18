import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { learnerStore } from '../../learning/src/learner-store.js';
import { learnerContext, validateProfile } from '../../learning/src/learner-context.js';
test('two hosts merge evidence without losing user statements or duplicating migration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-learner-'));try{
 const a=learnerStore(dir),b=learnerStore(dir);
 await a.saveProfile({goals:['Understand retries'],known:['Comfortable with JavaScript'],preferences:'Visual examples'});
 const evidence={id:'attempt1',objective:'Retry safety',verdict:'correct',assisted:true,createdAt:'2026-11-02T12:00:00Z'};
 await Promise.all([a.mergeEvidence('codex',[evidence]),b.mergeEvidence('opencode',[{...evidence,id:'attempt2',objective:'CSS layout'}])]);
 await a.mergeEvidence('codex',[evidence]);
 const saved=await b.read();assert.equal(saved.evidence.length,2);assert.equal(saved.profile.goals[0],'Understand retries');
 const context=learnerContext(saved,'retry handling');assert.equal(context.topics[0].objective,'Retry safety');assert.equal(context.topics[0].status,'practiced_with_assistance');assert.equal(context.profile.known[0],'Comfortable with JavaScript');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('profile input is explicit bounded data, never assessed knowledge',()=>{
 assert.throws(()=>validateProfile({goals:['x'],known:[],preferences:'',mastered:true}));
 assert.throws(()=>validateProfile({goals:['x'.repeat(201)],known:[],preferences:''}));
 const context=learnerContext({profile:{goals:['Learn databases'],known:['I know SQL'],preferences:''},evidence:[]},'SQL');assert.equal(context.topics.length,0);assert.match(context.uncertainty,/self.reported/);
});
test('export/import restores a new device, merges idempotently, and preserves current profile',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-transfer-'));try{
 const a=learnerStore(join(dir,'a')),b=learnerStore(join(dir,'b'));
 await a.saveProfile({goals:['Understand caches'],known:[],preferences:'Short explanations'});
 await a.mergeEvidence('codex',[{id:'one',objective:'Cache invalidation',verdict:'partial',createdAt:'2026-11-02T12:00:00Z'}]);
 const bundle=await a.export();await b.import(bundle);await b.import(bundle);
 assert.equal((await b.read()).evidence.length,1);assert.deepEqual((await b.read()).profile,bundle.profile);
 await b.saveProfile({goals:['New goal'],known:[],preferences:''});await b.import(bundle);assert.equal((await b.read()).profile.goals[0],'New goal');
 assert.throws(()=>b.import({...bundle,evidence:[{...bundle.evidence[0],objective:''}]}));assert.equal((await b.read()).evidence.length,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
import {LearningEngine} from '../src/learning-engine.js';
test('profile personalizes goals; opportunity model does not change assessment model',async()=>{
 const calls=[];const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async input=>{calls.push(input);return{text:JSON.stringify(input.intent==='goals'?{tool:'stay_silent',input:{reason:'Thin evidence'},reason:'Wait'}:{tool:'assess_answer',input:{verdict:'partial',feedback:'More detail needed',next:'Try again'},reason:'Check'})}}},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}},defaultLearningModel:{providerID:'native',modelID:'teacher'}});
 await e.load();await e.command({action:'enable'});await e.command({action:'save-learner-profile',value:{goals:['Understand retries'],known:['JavaScript'],preferences:'Visual examples'}});
 await e.command({action:'set-context-model',value:{providerID:'native',modelID:'small'}});
 await e.runLearningIntent('w',{intent:'goals',prompt:'Retry work'});
 await e.runLearningIntent('w',{intent:'assessment',prompt:'Assess this answer'});
 assert.equal(calls[0].model.modelID,'small');assert.equal(calls[1].model.modelID,'teacher');assert.match(calls[0].prompt,/Understand retries/);assert.match(calls[1].prompt,/Visual examples/);
});
test('corrupt shared memory never overwrites the original file',async()=>{
 const {writeFile,readFile}=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'dd-corrupt-'));try{
 await writeFile(join(dir,'learner.json'),'broken');await assert.rejects(learnerStore(dir).saveProfile({goals:[],known:[],preferences:''}),/preserved/);assert.equal(await readFile(join(dir,'learner.json'),'utf8'),'broken');
 }finally{await rm(dir,{recursive:true,force:true})}
});
import {learnerTopics} from '../../learning/src/learner-context.js';
test('cross-host topic grouping preserves meaningful punctuation and only merges matching labels',()=>{
 const item=(id,objective,skillId)=>({id,objective,skillId,verdict:'partial',createdAt:'2026-11-02T12:00:00Z'});
 const topics=learnerTopics({evidence:[item('1','C++','a'),item('2','C','b'),item('3',' c++ ','c')]});assert.equal(topics.length,2);assert.equal(topics.find(t=>t.objective==='C++').attempts,2);
});
test('selected topics travel as exploration history without manufacturing assessment evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dd-exploration-'));try{
 const a=learnerStore(join(dir,'a')),b=learnerStore(join(dir,'b'));await a.noteExploration('codex',{objective:'Local memory',path:['Persistence','Safe writes']});await a.noteExploration('codex',{objective:'Local memory',path:['Persistence','Safe writes']});
 await b.import(await a.export());const saved=await b.read();assert.equal(saved.explorations.length,1);assert.equal(saved.evidence.length,0);assert.equal(learnerContext(saved,'memory').topics.length,0);assert.equal(learnerContext(saved,'memory').recentlyExplored[0].objective,'Local memory');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('importing snoozes stays exportable and preserves spaced-review scheduling',async()=>{
 const {reviewLedger}=await import('../../learning/src/review-ledger.js');const dir=await mkdtemp(join(tmpdir(),'dd-review-transfer-'));
 try{const store=learnerStore(dir);const base={format:'dontdumb-learner',version:1,profile:{goals:[],known:[],preferences:''},evidence:[{id:'a',momentId:'a',host:'codex',objective:'Retry safety',project:'payments',verdict:'correct',createdAt:'2026-01-01T00:00:00Z'},{id:'b',momentId:'b',host:'codex',objective:'Retry safety',project:'payments',verdict:'correct',conditions:{mode:'review'},createdAt:'2026-01-02T00:00:00Z'}]};
 for(let batch=0;batch<2;batch++)await store.import({...base,reviewSnoozes:Object.fromEntries(Array.from({length:1000},(_,i)=>[`topic-${batch}-${i}`,'2026-01-05T00:00:00Z']))});
 const bundle=await store.export();assert.equal(Object.keys(bundle.reviewSnoozes).length,1000);await store.import(bundle);assert.equal(reviewLedger((await store.read()).evidence)[0].dueAt,'2026-01-09T00:00:00.000Z');
 }finally{await rm(dir,{recursive:true,force:true});}
});
