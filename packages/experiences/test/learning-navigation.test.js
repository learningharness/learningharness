import test from 'node:test';import assert from 'node:assert/strict';import {navigationGroups} from '../src/learning-navigation.js';
test('suggestions use the tutor’s mechanisms and adjacent concepts, not a fixed quiz promotion',()=>{
 const moment={objective:'Cache invalidation',deeper:'A pending GET can refill after invalidation',sibling:'Versioning stale responses',question:''};
 const nav=navigationGroups([{id:'quiz-me',label:'Quiz me'},{id:'dig-deeper',label:'Dig deeper'},{id:'zoom-out',label:'Zoom out'}],moment);
 assert.equal(nav.primary,null);assert.deepEqual(nav.explorations.map(m=>m.label),['A pending GET can refill after invalidation','Versioning stale responses']);
});
test('pending question keeps its hint while dismissal and tools are separate from suggestions',()=>{
 const nav=navigationGroups([{id:'hint',label:'Hint'},{id:'easier',label:'Easier'}],{objective:'Cache invalidation',question:'What can race?'});
 assert.equal(nav.primary.id,'hint');assert.match(nav.explorations[0].label,/Cache invalidation/);assert(!nav.explorations.some(m=>['dismiss','create-flashcard-deck','create-confidence-quiz'].includes(m.id)));
});

test('a complete lesson does not show quiz hints or easier-question actions before optional practice opens',()=>{
 const moment={lesson:{sections:[]},question:'A related optional question',objective:'Actual cache approach'};
 const moves=[{id:'hint',label:'Hint'},{id:'easier',label:'Easier question'},{id:'show-code',label:'Show code'}];
 assert.deepEqual(navigationGroups(moves,moment,undefined,{practiceOpen:false}),{primary:null,explorations:[]});
 assert.equal(navigationGroups(moves,moment,undefined,{practiceOpen:true}).primary.id,'hint');
});

test('unopened optional practice does not promote quiz helpers or hide specific exploration',()=>{
 const moment={lesson:{sections:[]},question:'Optional question',objective:'Token ownership',deeper:'Why stale rejection preserves a replacement',sibling:'How concurrent callers share work'};
 const moves=[{id:'hint',label:'Hint'},{id:'dig-deeper',label:'Dig deeper'},{id:'zoom-out',label:'Pick another goal'}];
 const nav=navigationGroups(moves,moment,undefined,{practiceOpen:false});assert.equal(nav.primary,null);assert.deepEqual(nav.explorations.map(m=>m.id),['dig-deeper','zoom-out']);assert.match(nav.explorations[0].label,/stale rejection/);
});
