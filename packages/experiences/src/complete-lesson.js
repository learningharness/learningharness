import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';
import {journeyPlanSchema,validateJourneyPlan} from './journey-plan.js';
const string=maxLength=>({type:'string',minLength:1,maxLength});
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const completeLessonSchema={...object({sections:{type:'array',minItems:2,maxItems:4,items:{...object({title:string(80),body:string(600),sourceIds:{type:'array',maxItems:3,items:string(200)},code:object({sourceId:string(200),quote:string(600)})}),required:['title','body']}},takeaway:string(240),journey:journeyPlanSchema}),required:['sections','takeaway']};
export function validateCompleteLesson(value){
 exactObject(value,['sections','takeaway','journey'],['sections','takeaway']);
 if(!Array.isArray(value.sections)||value.sections.length<2||value.sections.length>4)throw Error('A complete lesson needs 2–4 short sections');
 const text=(value,path,max)=>{nonEmptyString(value,path,max);if(!value.trim())throw Error('Lesson text must not be blank');return value.trim();};
 return {...(value.journey?{journey:validateJourneyPlan(value.journey)}:{}),sections:value.sections.map(section=>{
  exactObject(section,['title','body','sourceIds','code'],['title','body']);
  if(section.sourceIds!==undefined&&(!Array.isArray(section.sourceIds)||section.sourceIds.length>3||new Set(section.sourceIds).size!==section.sourceIds.length))throw Error('Invalid lesson citations');
  section.sourceIds?.forEach(id=>text(id,'$.sourceIds',200));
  let code;
  if(section.code!==undefined){
   exactObject(section.code,['sourceId','quote']);
   const sourceId=text(section.code.sourceId,'$.code.sourceId',200);
   text(section.code.quote,'$.code.quote',600);
   if(section.code.quote.split('\n').length>12)throw Error('Code focus needs at most 12 lines');
   code={sourceId,quote:section.code.quote}; // Preserve the exact captured whitespace.
  }
  return {...(section.sourceIds?{sourceIds:[...section.sourceIds]}:{}),...(code?{code}:{}),title:text(section.title,'$.title',80),body:text(section.body,'$.body',600)};
 }),takeaway:text(value.takeaway,'$.takeaway',240)};
}

// Re-resolve at display time too: old or missing evidence must never turn a
// model-authored quotation into apparent source code.
export function lessonCodeFocus(section,sources=[]){
 const code=section?.code;
 if(!code||typeof code.quote!=='string'||!code.quote.trim()||code.quote.length>600||code.quote.split('\n').length>12||!section.sourceIds?.includes(code.sourceId)||/^\[(?:excerpt|truncated|omitted)\]$/mi.test(code.quote))return null;
 const source=sources.find(source=>source.id===code.sourceId&&typeof source.text==='string'&&source.text.includes(code.quote));
 return source?{source,quote:code.quote}:null;
}
