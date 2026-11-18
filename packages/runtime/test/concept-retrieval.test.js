import test from 'node:test';
import assert from 'node:assert/strict';
import {learnerContext,learnerTopics} from '../../learning/src/learner-context.js';
const evidence=(id,objective,extra={})=>({id,objective,skillId:id,verdict:'incorrect',createdAt:'2026-11-01T00:00:00Z',...extra});

test('retrieves cache invalidation evidence for stale-result wording without changing evidence',()=>{
 const attempt=evidence('cache','Cache invalidation',{assisted:true,assistance:[{kind:'hint'}],conditions:{mode:'practice',sourceExposed:true}});
 const data={evidence:[attempt]};const original=structuredClone(data);
 const context=learnerContext(data,'Why are stale results still being served?');
 assert.equal(context.topics[0]?.objective,'Cache invalidation');
 assert.equal(context.recent[0]?.id,'cache');assert.equal(context.recent[0]?.assisted,true);
 assert.deepEqual(context.recent[0]?.conditions,attempt.conditions);
 assert.equal(context.topics[0].independentCorrect,0);assert.deepEqual(data,original);
});

test('mechanism aliases recall retry safety and lost updates across wording',()=>{
 const data={evidence:[evidence('retry','Idempotency'),evidence('race','Race conditions')]};
 assert.equal(learnerContext(data,'Prevent duplicate requests').topics[0]?.objective,'Idempotency');
 assert.equal(learnerContext(data,'Two writers lost an update').topics[0]?.objective,'Race conditions');
});

test('ambiguous stale or duplicate language does not activate mechanism aliases',()=>{
 const data={evidence:[evidence('cache','Cache invalidation'),evidence('retry','Idempotency')]};
 for(const query of ['A stale design document','Duplicate headings in the presentation','Write a sorting routine']){
  assert.deepEqual(learnerContext(data,query).topics,[],query);
 }
});

test('retrieval aliases do not merge distinct objectives or alter skill selection',()=>{
 const data={evidence:[evidence('cache','Cache invalidation'),evidence('ttl','Cache freshness'),evidence('css','CSS layout')]};
 assert.equal(learnerTopics(data).length,3);
 const recalled=learnerContext(data,'stale results');assert.equal(recalled.topics.length,2);
 assert.ok(recalled.topics.every(t=>t.attempts===1));
 assert.equal(learnerContext(data,'', 'css').topics[0]?.objective,'CSS layout');
});
