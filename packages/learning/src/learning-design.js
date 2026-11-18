import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';
export const CAPABILITIES=['explain','predict','distinguish','find_boundary','choose','apply_elsewhere'];
export const APPROACHES=['worked_example','contrast_then_explain','challenge_first','explanation'];
const BASIS=['unknown','self_report','exposure','assisted_practice','unassisted_practice','delayed_review'];
const string=maxLength=>({type:'string',minLength:1,maxLength});
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const learningDesignSchema=object({version:{type:'integer',enum:[1]},newAbility:string(160),distinction:object({left:string(100),right:string(100)}),addsBeyond:string(180),capability:{type:'string',enum:CAPABILITIES},approach:{type:'string',enum:APPROACHES},basis:object({kind:{type:'string',enum:BASIS},evidenceIds:{type:'array',maxItems:3,items:string(240)}})});
// A design is the tutor's falsifiable hypothesis, not an assessment outcome.
export function validateLearningDesign(value,learner){
 exactObject(value,['version','newAbility','distinction','addsBeyond','capability','approach','basis']);
 if(value.version!==1||!CAPABILITIES.includes(value.capability)||!APPROACHES.includes(value.approach))throw Error('Unsupported learning design');
 nonEmptyString(value.newAbility,'$.newAbility',160);nonEmptyString(value.addsBeyond,'$.addsBeyond',180);
 exactObject(value.distinction,['left','right']);for(const key of ['left','right'])nonEmptyString(value.distinction[key],'$.distinction.'+key,100);
 if(value.distinction.left.trim().toLowerCase()===value.distinction.right.trim().toLowerCase())throw Error('Learning distinction needs distinct alternatives');
 exactObject(value.basis,['kind','evidenceIds']);const {kind,evidenceIds}=value.basis;
 if(!BASIS.includes(kind)||!Array.isArray(evidenceIds)||evidenceIds.length>3||new Set(evidenceIds).size!==evidenceIds.length)throw Error('Invalid learning evidence basis');
 evidenceIds.forEach(id=>nonEmptyString(id,'$.evidenceId',240));
 if(['unknown','self_report','exposure'].includes(kind)&&evidenceIds.length)throw Error('Statements and exposure are not assessment evidence');
 if(kind.endsWith('_practice')||kind==='delayed_review'){
  if(!evidenceIds.length)throw Error('Practice basis needs evidence IDs');
  if(learner)for(const id of evidenceIds){const item=learner.find(e=>e.id===id);if(!item||item.verdict==='self_reported')throw Error('Unknown assessment evidence');const assisted=item.assisted===true||Boolean(item.assistance?.length);if(kind==='unassisted_practice'&&assisted)throw Error('Cannot call assisted practice unassisted');if(kind==='assisted_practice'&&!assisted)throw Error('No assisted practice recorded');if(kind==='delayed_review'&&(item.imported||item.learningEvent?.kind!=='delayed_review'||item.learningEvent.delayMs<86400000))throw Error('No verified delayed-review evidence');}
 }
 return structuredClone(value);
}
export function reviewTiming(evidence,objective,now,isReview){
 if(!isReview)return {kind:'immediate_practice'};
 const current=Date.parse(now),key=String(objective).trim().toLowerCase();
 const prior=evidence.filter(e=>String(e.objective).trim().toLowerCase()===key&&Date.parse(e.createdAt)<current).map(e=>Date.parse(e.createdAt));
 if(!prior.length)return {kind:'review_timing_unknown'};
 const delayMs=current-Math.max(...prior);return {kind:delayMs>=86400000?'delayed_review':'same_day_review',delayMs};
}
export function capabilityMetadata(item){
 const result={};if(CAPABILITIES.includes(item.capability))result.capability=item.capability;
 const event=item.learningEvent;if(event&&['immediate_practice','review_timing_unknown','same_day_review','delayed_review'].includes(event.kind)&&Object.keys(event).every(k=>['kind','delayMs'].includes(k))&&(event.delayMs===undefined||Number.isFinite(event.delayMs)&&event.delayMs>=0))result.learningEvent=structuredClone(event);
 if(item.imported===true)result.imported=true;return result;
}
export function capabilityEvidence(attempts=[]){
 const groups=new Map();for(const item of attempts){if(!CAPABILITIES.includes(item.capability)||item.verdict==='self_reported')continue;
 const key=String(item.objective).trim().toLowerCase()+'|'+item.capability;
 const group=groups.get(key)??{objective:item.objective,capability:item.capability,attempts:0,assistedCorrect:0,unassistedCorrect:0,delayedReviewAttempts:0};group.attempts++;if(item.verdict==='correct')group[item.assisted||item.assistance?.length?'assistedCorrect':'unassistedCorrect']++;if(item.learningEvent?.kind==='delayed_review')group.delayedReviewAttempts++;groups.set(key,group);
 }return [...groups.values()];
}
export function learnerBrief(context={}){
 const attempts=(context.recent??[]).slice(-4).map(e=>({id:e.id,objective:e.objective,...capabilityMetadata(e),verdict:e.verdict,assisted:e.assisted===true||Boolean(e.assistance?.length),question:String(e.question??'').slice(0,200),answer:String(e.answer??'').slice(0,240),feedback:String(e.feedback??'').slice(0,160),createdAt:e.createdAt}));
 return {selfReported:context.profile??{goals:[],known:[],preferences:''},exposure:(context.recentlyExplored??[]).slice(-3).map(e=>({objective:e.objective,lastAt:e.lastAt})),attempts,capabilities:capabilityEvidence(attempts),countScope:'Only supplied relevant attempts; not a complete ability estimate.',uncertainty:'Self-reports and exposure are not assessed skill. Unseen capabilities remain unknown. Retention and transfer remain unproven; different wording is not a verified new task.'};
}
export const learningDesignInstructions=`Choose a consequential distinction that helps this learner reason about their code. First evaluate learner goals and specific prior evidence, then the activity. Add a learningDesign hypothesis: version1,newAbility,distinction{left,right},addsBeyond (additional reasoning beyond supplied summaries and prior teaching),capability(explain/predict/distinguish/find_boundary/choose/apply_elsewhere),approach(worked_example/contrast_then_explain/challenge_first/explanation),basis{kind:unknown/self_report/exposure/assisted_practice/unassisted_practice/delayed_review,evidenceIds:[]}. Only cite supplied assessment IDs for practice; statements/exposure use no IDs. Unknown stays unknown. Expertise is topic-specific. For new topics, work the requested example or comparison through its explicit outcomes before adding another boundary. For relevant experts, derive an unstated consequence or design tradeoff in the lesson itself. Repeating an explicit task rule then varying its example adds no expert capability. Honor explicit explanation requests; no compulsory diagnostic. Contrasts should isolate a named varying feature and explain its causal effect, not merely display two unrelated examples. A novel challenge can inform the next move, but is not proof of retention/transfer. Never teach observation status, supervise code or repeat the coding answer as a lesson. Name a consequential distinction that changes a prediction or decision. Renaming the coding deliverable is not added value. Agent explanations are exposure, not assessed understanding: build on them with a useful missing distinction rather than replaying their same example. If no additional learner value is available, stay_silent. No fixed domain templates; author the subject from the evidence.`;
