import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {redactValue} from './redaction.js';
const stop=new Set('the and this that with from your into what how why understand learn work code about'.split(' '));
export const topicWords=value=>new Set((String(value??'').toLowerCase().match(/[a-z0-9]{3,}/g)??[]).map(w=>w.endsWith('ies')?w.slice(0,-3)+'y':w.length>4&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w).filter(w=>!stop.has(w)));
const matches=(a,b)=>[...topicWords(a)].filter(w=>topicWords(b).has(w)).length;
export function substantiveTask(value){
 const text=String(value??'').trim();
 const acknowledgement=/^(?:(?:yes|ok(?:ay)?|sure|approved|sounds good)[,!.:\s]*)?(?:please\s+)?(?:go ahead and\s+)?(?:implement|apply|do|build)\s+(?:it|that|this|(?:the|those|these) changes|the (?:proposed )?plan)[.!\s]*$/i;
 return text.length>=10&&!acknowledgement.test(text)&&!/^(?:ok(?:ay)?|yes|no|thanks?(?: you)?|continue|go ahead|do it|sounds good|hello|hi|done)[.!\s]*$/i.test(text)&&topicWords(text).size>=2;
}
export function sessionContext(value={},previous={}){
 const clean=redactValue(value);const title=String(clean.title??previous.title??'').replace(/[\x00-\x1f]/g,' ').slice(0,160);
 const path=String(clean.project??previous.project??'').replace(/\\/g,'/').replace(/\/$/,'');
 const projectKey=value.project==null?previous.projectKey:/^(?:\/|[a-z]:\/)/i.test(path)?`project_${createHash('sha256').update(posix.normalize(path)).digest('hex').slice(0,32)}`:undefined;
 const candidate=previous.codingOpening??clean.codingOpening;
 const codingOpening=candidate&&typeof candidate.id==='string'&&typeof candidate.text==='string'&&candidate.text.trim()?{id:candidate.id,text:candidate.text}:undefined;
 return {...(projectKey?{projectKey}:{}),...(codingOpening?{codingOpening}:{}),title:/^(?:new (?:chat|session)|untitled|chat)$/i.test(title)?'':title,project:path.split('/').filter(Boolean).at(-1)?.slice(0,120)??''};
}
// Explicit learner choices supersede ambient coding intent. Requests remain data,
// never instructions to execute coding work or evidence of completed changes.
export function learningDirection(session,{goal=null,request=null,ambient=false}={}){
 const choices=[['learner-request',request],['selected-learning-topic',ambient?null:goal?.outcome??(!session.moment?.completed?session.selectedGoal?.outcome??session.moment?.userRequest:null)],['chat-learning-focus',session.learningFocus],['recent-coding-task',substantiveTask(session.workSelection?.task?.data.text)?session.workSelection.task.data.text:null],['coding-session-opening',session.context?.codingOpening?.text]];
 const selected=choices.find(([,text])=>typeof text==='string'&&text.trim());
 return selected?{source:selected[0],text:selected[1]}:{source:'none',text:''};
}
export function openingPacket(session,packet){
 return {...packet,context:{...packet.context,sessionFocus:session.learningFocus??'',sessionTitle:session.context?.title??'',project:session.context?.project??'',directionSource:learningDirection(session,{ambient:true}).source,signalPriority:{explicitLearningChoice:200,codingSessionOpening:50,recentCodingTask:150,observedOutcome:90,learnerGoals:60,sessionTitle:30},stage:packet.changes?.length?'observed-work':'task-intent'}};
}
export function rankOpportunities(goals,session,learner){
 const direction=learningDirection(session,{ambient:true}).text;
 const task=session.workSelection?.task?.data.text??'',title=session.context?.title??'',goalsText=learner.profile?.goals?.join(' ')??'';
 const known=learner.profile?.known?.join(' ')??'',seen=new Set();
 return goals.filter(g=>{const key=g.outcome.trim().toLowerCase();if(seen.has(key)||/^(?:understand|learn|explore) (?:this|the) (?:work|code|task|repo)(?: better)?[.!]?$/i.test(key))return false;seen.add(key);return true;}).map((goal,index)=>({goal,index,score:matches(goal.outcome+' '+goal.whyNow,direction)*200+matches(goal.outcome+' '+goal.whyNow,task)*50+matches(goal.outcome,goalsText)*60+matches(goal.outcome,title)*30-matches(goal.outcome,known)*15})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).map(x=>x.goal);
}
