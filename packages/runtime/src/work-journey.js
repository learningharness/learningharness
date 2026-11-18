import {validateJourneyPlan} from '../../experiences/src/journey-plan.js';
import {learningOrigin} from '../../learning/src/past-learning.js';
const clone=value=>structuredClone(value);
export function attachJourney(state,sessionID,moment){
 if(moment.journey||!moment.lesson?.journey)return;
 const plan=validateJourneyPlan(moment.lesson.journey,moment.objective);
 const existing=Object.values(state.journeys??{}).find(item=>item.stages[0]?.moment.id===moment.id);
 if(existing){moment.journey={id:existing.id,index:0};return;}
 const id=`journey_${globalThis.crypto.randomUUID()}`;
 state.journeys??={};
 state.journeys[id]={id,plan,ownerSessionID:sessionID,origin:learningOrigin(state,{...moment,sessionID}),snapshot:clone(moment.snapshot),skillId:moment.skillId,createdAt:moment.createdAt,stages:{}};
 moment.journey={id,index:0};
 const entries=Object.values(state.journeys);for(const old of entries.slice(0,Math.max(0,entries.length-20)))delete state.journeys[old.id];
}
export function saveJourneyStage(state,session){
 const ref=session.moment?.journey,journey=ref&&state.journeys?.[ref.id];
 if(!journey||journey.ownerSessionID!==session.id||session.moment.presentation==='revisit')return;
 journey.stages[ref.index]=clone(Object.fromEntries(['moment','feedback','hint','askAnswer','draft','showCode','selectedGoal'].map(key=>[key,session[key]??null])));
}
export function publicJourneys(state){
 return Object.values(state.journeys??{}).reverse().map(journey=>({id:journey.id,destination:journey.plan.destination,origin:journey.origin,createdAt:journey.createdAt,steps:journey.plan.steps.map((step,index)=>{
  const saved=journey.stages[index],feedback=saved?.feedback;
  const status=feedback?(feedback.verdict==='correct'?(feedback.evidenceLabel==='practiced_with_assistance'?'Practised with help':'Correct on this attempt'):'Needs another look'):saved?'Opened':'Not opened';
  return {...step,index,status};
 })}));
}
