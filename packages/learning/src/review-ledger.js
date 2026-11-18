import {topicWords} from './opening-context.js';
// Local review scheduling. Recall evidence is not a mastery certification.
const DAY=86400000,intervals=[1,7,30];
export const conceptKey=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const tokens=topicWords;
const overlap=(a,b)=>[...tokens(a)].filter(w=>tokens(b).has(w)).length;
export function reviewLedger(evidence=[]){
 const concepts=new Map(),seen=new Set();
 const ordered=evidence.filter(e=>e?.objective&&['correct','partial','incorrect','self_reported'].includes(e.verdict)&&Number.isFinite(Date.parse(e.createdAt))).slice().sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 for(const e of ordered){
  const attempt=e.momentId?`${e.host??''}:${e.momentId}`:e.id;
  if(!attempt||seen.has(attempt))continue;seen.add(attempt);
  const key=conceptKey(e.objective),time=Date.parse(e.createdAt),previous=concepts.get(key);
  const topic=previous??{key,objective:e.objective,stage:0,attempts:0,misses:0,dueAt:new Date(time+DAY).toISOString()};
  topic.projectKeys??=[];if(e.projectKey&&!topic.projectKeys.includes(e.projectKey))topic.projectKeys.push(e.projectKey);
  topic.attempts++;topic.lastAt=e.createdAt;topic.momentId=e.momentId;topic.host=e.host;topic.projectKey=e.projectKey;topic.project=e.project??topic.project;topic.sessionTitle=e.sessionTitle??topic.sessionTitle;
  if(e.verdict==='self_reported'){topic.selfReported=true;topic.dueAt=new Date(time+(e.selfRating==='missed'?DAY/6:DAY)).toISOString();topic.status='self_reported_recall';concepts.set(key,topic);continue;}
  const assisted=e.confidence==='low'||e.assisted===true||Boolean(e.assistance?.length);
  if(e.verdict!=='correct')topic.misses++;
  if(previous&&['review','imported_review'].includes(e.conditions?.mode)){
   if(e.verdict!=='correct'||assisted){topic.stage=0;topic.dueAt=new Date(time+DAY).toISOString();}
   else if(time>=Date.parse(topic.dueAt)){topic.stage=Math.min(3,topic.stage+1);topic.dueAt=new Date(time+intervals[Math.min(topic.stage,2)]*DAY).toISOString();}
  }
  if(e.calibration==='confident_error')topic.dueAt=new Date(time+DAY/6).toISOString();
  topic.status=topic.stage>=3?'retained_review':'review_due';
  concepts.set(key,topic);
 }
 return [...concepts.values()];
}
export function selectReview(data,{task='',title='',project='',projectKey=''}={},now=new Date().toISOString()){
 const time=Date.parse(now);if(!Number.isFinite(time))return null;
 const candidates=reviewLedger(data.evidence).filter(t=>Date.parse(t.dueAt)<=time&&!(Date.parse(data.reviewSnoozes?.[t.key])>time));
 const goals=(data.profile?.goals??[]).join(' ');
 return candidates.map(topic=>{
  const taskMatch=overlap(topic.objective,task),titleMatch=overlap(topic.objective,title),projectMatch=Boolean(projectKey&&topic.projectKeys?.length?topic.projectKeys.includes(projectKey):!topic.projectKeys?.length&&project&&topic.project===project);
  if(task&&!taskMatch&&!projectMatch)return null;
  if(!task&&!projectMatch&&!titleMatch&&!overlap(topic.objective,goals))return null;
  return {...topic,relevance:taskMatch?'task':projectMatch?'project':'goal',score:taskMatch*100+Number(projectMatch)*50+titleMatch*25+overlap(topic.objective,goals)*20+Math.min(7,(time-Date.parse(topic.dueAt))/DAY)};
 }).filter(Boolean).sort((a,b)=>b.score-a.score)[0]??null;
}
