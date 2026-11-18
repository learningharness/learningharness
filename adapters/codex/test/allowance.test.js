import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAllowanceReader} from '../src/allowance.js';
import {allowanceReminder} from '../../../packages/experiences/src/allowance.js';
test('account allowance is sanitized, cached and never inferred from learning tokens',async()=>{
 let calls=0,now=1000000;const read=createAllowanceReader({now:()=>now,request:async()=>{calls++;return {email:'private',rateLimits:{limitId:'codex',primary:{usedPercent:20,windowDurationMins:300,resetsAt:now/1000+3600},secondary:{usedPercent:70,windowDurationMins:10080,resetsAt:now/1000+7200},credits:{balance:'private'}}};}});
 const result=await read();assert.equal(result.windows.length,2);assert.doesNotMatch(JSON.stringify(result),/private|email|credits/);await read();assert.equal(calls,1);
 const reminder=allowanceReminder(result,now);assert.equal(reminder.remainingPercent,30);assert.equal(reminder.label,'weekly');assert.equal(allowanceReminder(result,now+301000),null);
});
test('missing, exhausted, blocked, expired or malformed allowances produce no spend nudge',async()=>{
 const now=1000000;
 for(const window of [{usedPercent:100,windowDurationMins:10080,resetsAt:2000},{usedPercent:NaN,windowDurationMins:10080,resetsAt:2000},{usedPercent:20,windowDurationMins:10080,resetsAt:1}]){
  const read=createAllowanceReader({now:()=>now,request:async()=>({rateLimits:{limitId:'codex',secondary:window}})});assert.equal(allowanceReminder(await read(),now),null);
 }
 const denied=createAllowanceReader({request:async()=>{throw Error('unsupported')}});assert.equal(await denied(),null);
 const blocked=createAllowanceReader({now:()=>now,request:async()=>({rateLimits:{limitId:'codex',rateLimitReachedType:'rate_limit_reached',secondary:{usedPercent:20,windowDurationMins:10080,resetsAt:2000}}})});assert.equal(allowanceReminder(await blocked(),now),null);
});
