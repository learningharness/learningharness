import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';
const text=maxLength=>({type:'string',minLength:1,maxLength});
export const journeyPlanSchema={type:'object',additionalProperties:false,required:['destination','steps'],properties:{destination:text(160),steps:{type:'array',minItems:3,maxItems:4,items:{type:'object',additionalProperties:false,required:['objective','purpose','mode'],properties:{objective:text(160),purpose:text(160),mode:{type:'string',enum:['lesson','decision','practice']}}}}}};
export function validateJourneyPlan(value,objective){
 exactObject(value,['destination','steps']);nonEmptyString(value.destination,'$.destination',160);
 if(!value.destination.trim()||!Array.isArray(value.steps)||value.steps.length<3||value.steps.length>4)throw Error('A journey needs a destination and 3–4 connected steps');
 const steps=value.steps.map(step=>{exactObject(step,['objective','purpose','mode']);for(const key of ['objective','purpose']){nonEmptyString(step[key],`$.${key}`,160);if(!step[key].trim())throw Error('Journey steps must be specific');}if(!['lesson','decision','practice'].includes(step.mode))throw Error('Invalid journey step mode');return{objective:step.objective.trim(),purpose:step.purpose.trim(),mode:step.mode};});
 if(steps[0].mode!=='lesson'||steps[1].mode!=='decision'||(objective&&steps[0].objective!==objective)||steps.at(-1).mode!=='practice'||new Set(steps.map(step=>step.objective.toLowerCase())).size!==steps.length)throw Error('A journey starts at the selected objective, develops a distinct engineering decision, ends with practice, and has distinct steps');
 return{destination:value.destination.trim(),steps};
}
