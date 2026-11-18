import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGoals} from '../src/learning-engine.js';
const parse=outcome=>parseGoals(JSON.stringify({decision:'offer',goals:[{kind:'core',outcome,whyNow:'A stale callback may settle after replacement.',minutes:2}]}));
test('an invitation is a finished single-line plain-text heading, not broken code formatting',()=>{
 const broken='Trace how token identity separates stale promises from the current load for a `"';
 assert.throws(()=>parse(broken),/plain.text|single.line/);
 assert.throws(()=>parse('Why old callbacks\nleave new loads intact'),/plain.text|single.line/);
 assert.equal(parse('Why clear() does not cancel an existing caller').goals[0].outcome,'Why clear() does not cancel an existing caller');
});
