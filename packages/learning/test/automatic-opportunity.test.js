import test from 'node:test';import assert from 'node:assert/strict';
import {substantiveTask} from '../src/opening-context.js';
import {automaticCheckDelay} from '../src/automatic-opportunity.js';
test('acknowledgements do not spend an empty-context check before actual work arrives',()=>{
 for(const text of ['Yes, implement it','Yes, please implement it.','Yes, go ahead and implement it.','Okay, apply those changes.','Implement the plan','Go ahead','Okay'])assert.equal(substantiveTask(text),false,text);
 assert.equal(substantiveTask('Implement cache TTL with an injectable clock'),true);
 const session={automaticChecksThisTask:0,automaticCheckTimes:[]},selection={task:{data:{text:'Yes, implement it'}},entries:[]};
 assert.equal(automaticCheckDelay(session,selection,{now:1000}),null);
 selection.entries.push({priority:90,sequence:2});assert.equal(automaticCheckDelay(session,selection,{now:1000}),0);
});
test('fresh evidence is deferred to the cost gate, rather than discarded',()=>{
 const session={automaticChecksThisTask:1,lastOpportunitySequence:1,automaticCheckTimes:[1000]},selection={entries:[{priority:90,sequence:2}]};
 assert.equal(automaticCheckDelay(session,selection,{now:2000,minIntervalMs:120000}),119000);
 assert.equal(automaticCheckDelay(session,selection,{now:121000,minIntervalMs:120000}),0);
 assert.equal(automaticCheckDelay(session,{entries:[{priority:90,sequence:1}]},{now:121000}),null,'same evidence never creates a retry');
 session.automaticCheckTimes=[1000,2000,3000];assert.equal(automaticCheckDelay(session,selection,{now:4000,maxCallsPerWindow:3,windowMs:600000}),597000);
 session.automaticChecksThisTask=2;assert.equal(automaticCheckDelay(session,selection,{now:900000}),null,'the per-task cap still applies');
});
