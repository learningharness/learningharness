import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const now='2026-11-14T12:00:00Z';
async function fixture(stored=null){
 let data=stored,calls=0;
 const e=new LearningEngine({storage:{get:async()=>data,set:async(_key,value)=>{data=structuredClone(value);}},gateway:{generate:async()=>{calls++;throw Error('Unexpected generation');}},capabilities:{host:'codex',model:{independent:true},observation:{kinds:[]},surface:{}},now:()=>now});
 await e.load({resumeEnabled:true});return {e,saved:()=>data,calls:()=>calls};
}
async function seed(e){await e.command({action:'enable'});e.session('a').context={project:'cache'};e.session('a').evidence=[{id:'attempt',momentId:'old',objective:'Cache invalidation',project:'cache',verdict:'incorrect',createdAt:'2026-11-12T12:00:00Z'}];await e.syncLearner();}
test('return reminder is opt-in, durable, bounded across chats and never generates',async()=>{
 const f=await fixture();await seed(f.e);await f.e.openSession('a');assert.equal(f.e.snapshot('a').session.reviewReminder,null);
 await f.e.command({action:'set-reengagement',value:{remindersEnabled:true,dailyAttentionLimit:1}});
 await f.e.command({action:'surface-opened',sessionID:'a'});const reminder=f.e.snapshot('a').session.reviewReminder;assert.ok(reminder?.id);
 await assert.rejects(f.e.command({action:'ack-review-reminder',sessionID:'a',value:'forged'}),/reminder/i);
 await f.e.command({action:'ack-review-reminder',sessionID:'a',value:reminder.id});
 await f.e.command({action:'ack-review-reminder',sessionID:'a',value:reminder.id});
 const g=await fixture(f.saved());g.e.session('b').context={project:'cache'};await g.e.command({action:'surface-opened',sessionID:'b'});
 assert.equal(g.e.snapshot('b').session.reviewReminder,null);assert.ok(g.e.snapshot('b').session.reviewOffer);
 assert.equal(g.e.state.reengagement.attention.count,1);assert.equal(f.calls()+g.calls(),0);
});
test('Off, pause, active teaching, snooze and unrelated projects suppress reminders',async()=>{
 const {e,calls}=await fixture();await seed(e);await e.command({action:'set-reengagement',value:{remindersEnabled:true,dailyAttentionLimit:3}});
 for(const action of ['pause','disable']){await e.command({action,sessionID:'a'});await e.openSession('a');assert.equal(e.snapshot('a').session.reviewReminder,null);await e.command({action:action==='pause'?'resume':'enable',sessionID:'a'});}
 e.session('a').moment={id:'active',completed:false};await e.openSession('a');assert.equal(e.snapshot('a').session.reviewReminder,null);e.session('a').moment=null;
 await e.openSession('a');assert.ok(e.snapshot('a').session.reviewReminder);await e.command({action:'skip-review',sessionID:'a'});await e.openSession('a');assert.equal(e.snapshot('a').session.reviewReminder,null);
 e.session('other').context={project:'/unrelated'};await e.openSession('other');assert.equal(e.snapshot('other').session.reviewReminder,null);assert.equal(calls(),0);
 await assert.rejects(e.command({action:'set-reengagement',value:{remindersEnabled:'yes',dailyAttentionLimit:10}}),/reengagement/i);
});
test('another panel drops its unacknowledged reminder when a global receipt consumes the budget',async()=>{
 const {e,calls}=await fixture();await seed(e);e.session('b').context={project:'cache'};
 await e.command({action:'set-reengagement',value:{remindersEnabled:true,dailyAttentionLimit:1}});
 await e.openSession('a');await e.openSession('b');const id=e.session('a').reviewReminder.id;
 assert.equal(e.session('b').reviewReminder.id,id);
 await e.command({action:'ack-review-reminder',sessionID:'a',value:id});e.refreshReview(e.session('b'));
 assert.equal(e.session('b').reviewReminder,null);assert.ok(e.session('b').reviewOffer);assert.equal(e.state.reengagement.attention.count,1);
 await assert.rejects(e.command({action:'ack-review-reminder',sessionID:'b',value:id}),/reminder/i);
 assert.equal(e.state.reengagement.attention.count,1);assert.equal(calls(),0);
});
test('a second eligible reminder displays and acknowledges its own review rather than the top manual candidate',async()=>{
 const {e,calls}=await fixture();await seed(e);
 e.session('a').evidence.push({id:'second',momentId:'second',objective:'Cache expiry',project:'cache',verdict:'incorrect',createdAt:'2026-11-12T12:00:00Z'});await e.syncLearner();
 await e.command({action:'set-reengagement',value:{remindersEnabled:true,dailyAttentionLimit:2}});
 await e.openSession('a');const first=e.session('a').reviewReminder.id;await e.command({action:'ack-review-reminder',sessionID:'a',value:first});
 await e.openSession('a');const next=e.session('a').reviewReminder;assert.ok(next);assert.notEqual(next.id,first);
 assert.equal(e.session('a').reviewOffer.id,next.id);assert.equal(e.session('a').reviewOffer.objective,next.objective);
 await e.command({action:'ack-review-reminder',sessionID:'a',value:next.id});assert.equal(e.state.reengagement.attention.count,2);assert.equal(calls(),0);
});
