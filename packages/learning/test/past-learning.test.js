import test from 'node:test';import assert from 'node:assert/strict';
import {learningOrigin,reviewMaterial} from '../src/past-learning.js';
const original={id:'lesson-old',sessionID:'old',objective:'Token ownership',snapshot:[{id:'old-file',type:'file.changed',data:{path:'cache.js',content:'OLD_CAPTURE'}}]};
const state={history:[original],sessions:{old:{context:{project:'/old/cache',projectKey:'project_old',title:'Build a cache'}},now:{context:{project:'/new/ui',title:'Build a UI'}}}};
test('past learning retains original session context and independent frozen sources',()=>{
 const material=reviewMaterial(state,{momentId:'lesson-old',host:'codex'},'codex');assert.equal(material.sourceAvailable,true);assert.equal(material.origin.project,'/old/cache');assert.equal(material.snapshot[0].data.content,'OLD_CAPTURE');material.snapshot[0].data.content='changed';assert.equal(original.snapshot[0].data.content,'OLD_CAPTURE');
 assert.equal(learningOrigin(state,{...original,learningContext:{sessionID:'first',project:'/earlier',title:'Original'}}).project,'/earlier');
});
test('a missing or other-host source never borrows the active coding task',()=>{
 for(const topic of [{momentId:'missing'},{momentId:'lesson-old',host:'claude'}]){const material=reviewMaterial(state,topic,'codex');assert.deepEqual(material.snapshot,[]);assert.equal(material.sourceAvailable,false);}
});
test('original review sources survive when only a generated journey stage retains them',()=>{
 const journeyState={sessions:{now:{context:{project:'/new/ui'}}},journeys:{j:{ownerSessionID:'old',origin:{sessionID:'old',project:'/old/cache',title:'Original cache work'},stages:{0:{moment:original}}}}};
 const before=structuredClone(journeyState);const material=reviewMaterial(journeyState,{momentId:'lesson-old',host:'codex'},'codex');
 assert.equal(material.sourceAvailable,true);assert.equal(material.origin.project,'/old/cache');assert.equal(material.snapshot[0].data.content,'OLD_CAPTURE');assert.deepEqual(journeyState,before);
});
test('library groups reread copies under their original teaching without altering stored attempts',async()=>{
 const {savedLearning}=await import('../src/past-learning.js');
 const originalNote={...original,title:'Original teaching',body:'Original explanation'};
 const reread={...originalNote,id:'reread-1',revisitedOf:original.id,body:'Saved reread explanation',createdAt:'2026-02-01T00:00:00Z'};
 const libraryState={history:[reread,originalNote],sessions:{now:{moment:{...reread,id:'current-reread'}},old:{moment:{...reread,id:'another-reread'}}}};
 const before=structuredClone(libraryState);const records=savedLearning(libraryState,{currentSessionID:'now'});
 assert.equal(records.length,1);assert.equal(records[0].id,original.id);assert.equal(records[0].body,'Original explanation');assert.deepEqual(libraryState,before);
 const cloneOnly=savedLearning({history:[reread],sessions:{old:{moment:{...reread,id:'another-reread'}}}});
 assert.equal(cloneOnly.length,1);assert.equal(cloneOnly[0].revisitedOf,original.id);
});
test('review resolves a saved reread exact source even when the library groups it under original teaching',()=>{
 const reread={...original,id:'reread-source',revisitedOf:original.id,snapshot:[{id:'reread-file',type:'file.changed',data:{path:'cache.js',content:'EXACT_REREAD_CAPTURE'}}]};
 const material=reviewMaterial({history:[reread,original]}, {momentId:'reread-source',host:'codex'},'codex');
 assert.equal(material.sourceAvailable,true);assert.equal(material.snapshot[0].data.content,'EXACT_REREAD_CAPTURE');
});
