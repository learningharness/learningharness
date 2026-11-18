import test from 'node:test';import assert from 'node:assert/strict';
import {reviewLedger,selectReview} from '../../learning/src/review-ledger.js';
const at=day=>new Date(Date.UTC(2026,0,day)).toISOString();
const answer=(id,day,extra={})=>({id,momentId:id,objective:'Retry safety',question:'When is retry safe?',verdict:'correct',assisted:false,createdAt:at(day),project:'payments',...extra});
test('first practice creates a due review, same-moment changed answers cannot inflate it',()=>{
 const ledger=reviewLedger([answer('a',1,{verdict:'incorrect'}),answer('b',1,{momentId:'a'})]);
 assert.equal(ledger[0].attempts,1);assert.equal(ledger[0].stage,0);assert.equal(ledger[0].dueAt,at(2));assert.equal(ledger[0].misses,1);
});
test('only unassisted due reviews advance through1/7/30day intervals',()=>{
 const e=[answer('a',1),answer('early',1,{conditions:{mode:'review'}}),answer('b',2,{conditions:{mode:'review'}})];
 assert.equal(reviewLedger(e)[0].dueAt,at(9));
 e.push(answer('c',9,{conditions:{mode:'review'}}));assert.equal(reviewLedger(e)[0].dueAt,at(39));
 e.push(answer('d',39,{conditions:{mode:'review'}}));assert.equal(reviewLedger(e)[0].status,'retained_review');
 assert.equal(reviewLedger(e)[0].stage,3);
});
test('hinted or incorrect recall brings the concept back soon, not mastery',()=>{
 const e=[answer('a',1),answer('b',2,{conditions:{mode:'review'}}),answer('c',9,{assisted:true,conditions:{mode:'review'}})];
 assert.equal(reviewLedger(e)[0].stage,0);assert.equal(reviewLedger(e)[0].dueAt,at(10));
});
test('opening uses relevant due memory and respects snooze without changing evidence',()=>{
 const evidence=[answer('a',1),answer('b',1,{objective:'CSS layout',project:'website'})];
 assert.equal(selectReview({evidence},{project:'payments',title:'New chat'},at(3)).objective,'Retry safety');
 assert.equal(selectReview({evidence},{task:'Fix CSS layout',project:'website'},at(3)).objective,'CSS layout');
 assert.equal(selectReview({evidence},{task:'Write a poem about spring'},at(3)),null);
 assert.equal(selectReview({evidence:[answer('a',1)],reviewSnoozes:{'retry safety':at(4)}},{project:'payments'},at(3)),null);
 assert.equal(selectReview({evidence},{project:'payments'},at(1)),null);
});
test('imported answers do not turn into verified spaced-review successes',()=>{
 const e=[answer('a',1),answer('b',2,{imported:true,conditions:{mode:'imported_practice'}})];
 assert.equal(reviewLedger(e)[0].stage,0);
});
