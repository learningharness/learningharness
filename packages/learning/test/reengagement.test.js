import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReengagement,acknowledgeReengagement,validateReengagementSettings} from '../src/reengagement.js';
const now='2026-11-14T12:00:00.000Z';
const evidence=(objective='cache invalidation',extra={})=>({id:'first',momentId:'first',objective,createdAt:'2026-11-12T12:00:00.000Z',verdict:'correct',projectKey:'project-a',...extra});
const learner={evidence:[evidence()],profile:{goals:['cache invalidation']},reviewSnoozes:{}};
const base={learner,now,enabled:true,context:{task:'Explain cache invalidation',projectKey:'project-a'}};
const opted={remindersEnabled:true,dailyAttentionLimit:1};
const roundTrip=value=>JSON.parse(JSON.stringify(value));
test('local timers survive restart; reminders default quiet while manual review remains available',()=>{
 const input=roundTrip(base),first=reconcileReengagement(input);
 assert.equal(first.candidate.key,'cache invalidation');assert.equal(first.reminder,null);
 assert.equal(first.state.timers[0].dueAt,'2026-11-13T12:00:00.000Z');
 assert.deepEqual(reconcileReengagement({...input,state:roundTrip(first.state)}),first);
 assert.deepEqual(input,roundTrip(base));
});
test('one acknowledged reminder consumes the shared UTC day allowance without claiming practice',()=>{
 const first=reconcileReengagement({...base,settings:opted});assert.ok(first.reminder);
 const acknowledged=acknowledgeReengagement({state:first.state,id:first.reminder.id,now,settings:opted});
 assert.deepEqual(acknowledged.attention,{day:'2026-11-14',count:1});
 assert.equal(acknowledged.timers[0].acknowledgedAt,now);
 assert.equal('evidence' in acknowledged,false);
 const restarted=reconcileReengagement({...base,state:roundTrip(acknowledged),settings:opted,now:'2026-11-15T12:00:00.000Z'});
 assert.equal(restarted.reminder,null);assert.ok(restarted.candidate);
 assert.deepEqual(acknowledgeReengagement({state:acknowledged,id:first.reminder.id,now,settings:opted}),acknowledged);
});
test('Off, pause, active learning and irrelevant work suppress reminders without dropping timers',()=>{
 for(const override of [{enabled:false},{paused:true},{activeLearning:true},{context:{task:'SQL joins',projectKey:'project-b'}}]){
  const result=reconcileReengagement({...base,settings:opted,...override});assert.equal(result.reminder,null);assert.equal(result.state.timers.length,1);
 }
});
test('future snooze revokes pending readiness and acknowledgement; expiry restores it',()=>{
 const first=reconcileReengagement({...base,settings:opted});
 const snoozed=reconcileReengagement({...base,state:first.state,settings:opted,learner:{...learner,reviewSnoozes:{'cache invalidation':'2026-11-16T12:00:00.000Z'}}});
 assert.equal(snoozed.candidate,null);assert.equal(snoozed.reminder,null);assert.equal(snoozed.state.timers[0].readyAt,'2026-11-16T12:00:00.000Z');
 const acknowledged=acknowledgeReengagement({state:snoozed.state,id:first.reminder.id,now,settings:opted});assert.equal(acknowledged.attention.count,0);
 assert.ok(reconcileReengagement({...base,state:snoozed.state,settings:opted,now:'2026-11-16T12:00:00.000Z',learner:{...learner,reviewSnoozes:{'cache invalidation':'2026-11-16T12:00:00.000Z'}}}).reminder);
});
test('practice advances the durable timer and obsolete evidence cancels it',()=>{
 const first=reconcileReengagement({...base,settings:opted});
 const state=acknowledgeReengagement({state:first.state,id:first.reminder.id,now,settings:opted});
 const updated={...learner,evidence:[...learner.evidence,evidence('cache invalidation',{id:'review',momentId:'review',createdAt:now,conditions:{mode:'review'}})]};
 const advanced=reconcileReengagement({...base,state,learner:updated,settings:opted});
 assert.equal(advanced.state.timers.length,1);assert.equal(advanced.state.timers[0].dueAt,'2026-11-21T12:00:00.000Z');assert.equal(advanced.reminder,null);
 assert.ok(reconcileReengagement({...base,state:advanced.state,learner:updated,settings:opted,now:'2026-11-21T12:00:00.000Z'}).reminder);
 assert.deepEqual(reconcileReengagement({...base,state:advanced.state,learner:{...learner,evidence:[]}}).state.timers,[]);
});
test('best relevant unacknowledged due review is reminded without hiding the best manual review',()=>{
 const two={...learner,evidence:[evidence(),evidence('cache expiry',{id:'second',momentId:'second'})]};
 const first=reconcileReengagement({...base,learner:two,settings:{...opted,dailyAttentionLimit:2}});
 const state=acknowledgeReengagement({state:first.state,id:first.reminder.id,now,settings:{...opted,dailyAttentionLimit:2}});
 const next=reconcileReengagement({...base,learner:two,state,settings:{...opted,dailyAttentionLimit:2}});
 assert.equal(next.candidate.key,first.candidate.key);assert.notEqual(next.reminder.id,first.reminder.id);
});
test('daily budget resets at UTC midnight and a zero limit opts out',()=>{
 const first=reconcileReengagement({...base,now:'2026-11-14T23:59:59.000Z',settings:opted});
 const state=acknowledgeReengagement({state:first.state,id:first.reminder.id,now:'2026-11-14T23:59:59.000Z',settings:opted});
 const two={...learner,evidence:[...learner.evidence,evidence('cache expiry',{id:'second',momentId:'second'})]};
 assert.equal(reconcileReengagement({...base,learner:two,state,settings:opted}).reminder,null);
 assert.ok(reconcileReengagement({...base,learner:two,state,settings:opted,now:'2026-11-15T00:00:00.000Z'}).reminder);
 assert.equal(reconcileReengagement({...base,settings:{...opted,dailyAttentionLimit:0}}).reminder,null);
});
test('invalid settings fail closed and acknowledgement requires a current offer',()=>{
 assert.deepEqual(validateReengagementSettings(),{remindersEnabled:false,dailyAttentionLimit:1});
 for(const settings of [{remindersEnabled:'true'},{dailyAttentionLimit:4},{dailyAttentionLimit:-1},{dailyAttentionLimit:1.5},null])assert.throws(()=>validateReengagementSettings(settings));
 const result=reconcileReengagement(base);
 assert.equal(acknowledgeReengagement({state:result.state,id:result.candidate.id,now,settings:opted}).attention.count,0);
 assert.throws(()=>reconcileReengagement({...base,now:'not-a-date'}));
});
test('reconciling a disabled or irrelevant session revokes an earlier offer before acknowledgement',()=>{
 const first=reconcileReengagement({...base,settings:opted});
 for(const override of [{enabled:false},{paused:true},{activeLearning:true},{context:{task:'SQL joins',projectKey:'other'}},{settings:{remindersEnabled:false}}]){
  const revoked=reconcileReengagement({...base,state:first.state,settings:opted,...override});
  assert.equal(revoked.state.offeredId,null);
  assert.equal(acknowledgeReengagement({state:revoked.state,id:first.reminder.id,now,settings:opted}).attention.count,0);
 }
});
test('bounded retired delivery history does not erase acknowledgements on current timers',()=>{
 const first=reconcileReengagement({...base,settings:opted});
 const state=acknowledgeReengagement({state:first.state,id:first.reminder.id,now,settings:opted});
 state.acknowledged.push(...Array.from({length:1005},(_,i)=>({id:`retired:${i}`,at:now})));
 const restored=reconcileReengagement({...base,state:roundTrip(state),settings:opted,now:'2026-11-15T12:00:00.000Z'});
 assert.equal(restored.state.acknowledged.length,1000);assert.equal(restored.reminder,null);
 assert.equal(restored.state.timers[0].acknowledgedAt,now);assert.ok(restored.candidate);
});
test('clock reversal cannot replenish attention and a raised limit remains capped at three',()=>{
 const state={attention:{day:'2026-11-15',count:3}};
 assert.equal(reconcileReengagement({...base,state,settings:{...opted,dailyAttentionLimit:3}}).reminder,null);
 assert.deepEqual(reconcileReengagement({...base,state,settings:opted}).state.attention,state.attention);
});
