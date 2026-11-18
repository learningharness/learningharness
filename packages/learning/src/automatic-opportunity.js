import {opportunityDue} from './opportunity-policy.js';
// null means no eligible new work. A positive delay keeps that work pending
// without spending a model request or relaxing either automatic call budget.
export function automaticCheckDelay(session,selection,{now,minIntervalMs=0,maxCallsPerWindow=0,windowMs=600000,limit=2}={}){
 if(!Number.isFinite(now)||!opportunityDue(session,selection,limit))return null;
 const recent=(session.automaticCheckTimes??[]).filter(at=>Number.isFinite(at)&&now-at<windowMs).sort((a,b)=>a-b);
 const intervalAt=recent.length?recent.at(-1)+minIntervalMs:now;
 const windowAt=maxCallsPerWindow>0&&recent.length>=maxCallsPerWindow?recent[recent.length-maxCallsPerWindow]+windowMs:now;
 return Math.max(0,intervalAt-now,windowAt-now);
}
