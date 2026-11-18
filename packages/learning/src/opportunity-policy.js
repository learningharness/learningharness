import {substantiveTask,learningDirection} from './opening-context.js';
// No inference for sampling. One early look, then at most one evidence-triggered
// follow-up per task. Ordinary streaming tokens do not make a new opportunity.
export function opportunityDue(session,selection,limit=2){
 const count=session.automaticChecksThisTask??0;
 if(count>=limit)return false;
 if(!count)return substantiveTask(selection.task?.data?.text)||selection.entries.some(e=>e.priority>=60)||!(session.automaticCheckTimes?.length)&&substantiveTask(learningDirection(session).text);
 const fresh=selection.entries.filter(e=>e.sequence>(session.lastOpportunitySequence??0));
 return fresh.some(e=>e.priority>=85)||fresh.filter(e=>e.priority>=65).length>=3;
}
