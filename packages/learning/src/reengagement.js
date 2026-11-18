import {conceptKey,reviewLedger,selectReview} from './review-ledger.js';

// Serialized local readiness only: no timers, model calls, host messages or practice evidence.
// The caller persists state and explicitly acknowledges actual reminder delivery.
const MAX_TIMERS=10_000,MAX_HISTORY=1_000;
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const reviewId=topic=>`review:${topic.key}:${topic.dueAt}`;
function clock(now){if(!validTime(now))throw Error('Invalid reengagement time');return new Date(now).toISOString();}
export function validateReengagementSettings(settings={}){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Invalid reengagement settings');
 const {remindersEnabled=false,dailyAttentionLimit=1}=settings;
 if(typeof remindersEnabled!=='boolean'||!Number.isInteger(dailyAttentionLimit)||dailyAttentionLimit<0||dailyAttentionLimit>3)throw Error('Invalid reengagement settings');
 return {remindersEnabled,dailyAttentionLimit};
}
function restore(state,now){
 const day=now.slice(0,10),attention=state?.attention;
 // UTC day boundaries are shared across sessions. A backward clock does not refill attention.
 const keepDay=typeof attention?.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(attention.day)&&attention.day>=day;
 return {version:1,
  timers:(Array.isArray(state?.timers)?state.timers:[]).filter(t=>typeof t?.id==='string'&&typeof t.key==='string'&&validTime(t.dueAt)&&validTime(t.readyAt)).slice(0,MAX_TIMERS).map(t=>({id:t.id,key:t.key,dueAt:t.dueAt,readyAt:t.readyAt,...(validTime(t.acknowledgedAt)?{acknowledgedAt:t.acknowledgedAt}:{})})),
  acknowledged:(Array.isArray(state?.acknowledged)?state.acknowledged:[]).filter(a=>typeof a?.id==='string'&&validTime(a.at)).slice(-MAX_HISTORY).map(a=>({id:a.id,at:a.at})),
  attention:{day:keepDay?attention.day:day,count:keepDay&&Number.isInteger(attention.count)?Math.max(0,Math.min(3,attention.count)):0},
  offeredId:typeof state?.offeredId==='string'?state.offeredId:null};
}
const offer=topic=>topic?{...topic,id:reviewId(topic)}:null;

/** Derive durable review readiness from the existing learner ledger. Manual candidates
 * remain available independently of reminder preferences and delivery acknowledgements.
 * Call after evidence/snooze changes as well as on restart or foreground activity. */
export function reconcileReengagement({state,learner={},now,enabled,paused=false,context={},activeLearning=false,settings={}}){
 now=clock(now);const preferences=validateReengagementSettings(settings),next=restore(state,now);
 const records=reviewLedger(learner.evidence??[]).filter(t=>validTime(t.dueAt)).slice(0,MAX_TIMERS);
 const previous=new Map(next.timers.map(t=>[t.id,t])),receipts=new Map(next.acknowledged.map(a=>[a.id,a.at]));
 next.timers=records.map(topic=>{
  const id=reviewId(topic),snooze=learner.reviewSnoozes?.[topic.key],acknowledgedAt=previous.get(id)?.acknowledgedAt??receipts.get(id);
  return {id,key:topic.key,dueAt:topic.dueAt,readyAt:validTime(snooze)&&Date.parse(snooze)>Date.parse(topic.dueAt)?snooze:topic.dueAt,...(acknowledgedAt?{acknowledgedAt}:{})};
 });
 const candidate=offer(selectReview(learner,context,now));
 let reminder=null;
 if(enabled===true&&!paused&&!activeLearning&&preferences.remindersEnabled&&next.attention.count<preferences.dailyAttentionLimit){
  const eligible=new Set(next.timers.filter(t=>!t.acknowledgedAt&&Date.parse(t.readyAt)<=Date.parse(now)).map(t=>t.key));
  reminder=offer(selectReview({...learner,evidence:(learner.evidence??[]).filter(e=>eligible.has(conceptKey(e.objective)))},context,now));
 }
 next.offeredId=reminder?.id??null;
 return {state:next,candidate,reminder};
}

/** Acknowledge a currently offered reminder after actual delivery. This records
 * attention spent, never opening, practice, correctness, retention or mastery. */
export function acknowledgeReengagement({state,id,now,settings={}}){
 now=clock(now);const preferences=validateReengagementSettings(settings),next=restore(state,now);
 const timer=next.timers.find(t=>t.id===id);
 if(!preferences.remindersEnabled||next.attention.count>=preferences.dailyAttentionLimit||next.offeredId!==id||!timer||timer.acknowledgedAt||Date.parse(timer.readyAt)>Date.parse(now))return next;
 timer.acknowledgedAt=now;next.acknowledged=[...next.acknowledged.filter(a=>a.id!==id),{id,at:now}].slice(-MAX_HISTORY);
 next.attention.count++;next.offeredId=null;
 return next;
}
