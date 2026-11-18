import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';
const string=maxLength=>({type:'string',minLength:1,maxLength});
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const contrastSchema=object({varied:string(120),cases:{type:'array',minItems:2,maxItems:2,items:object({label:string(48),situation:string(200),result:string(160)})}});
export function validateContrast(value){
 exactObject(value,['varied','cases']);nonEmptyString(value.varied,'$.varied',120);if(!Array.isArray(value.cases)||value.cases.length!==2)throw Error('A contrast needs exactly two cases');
 for(const item of value.cases){exactObject(item,['label','situation','result']);nonEmptyString(item.label,'$.label',48);nonEmptyString(item.situation,'$.situation',200);nonEmptyString(item.result,'$.result',160);}
 const [a,b]=value.cases;if(a.situation.trim()===b.situation.trim()||a.label.trim()===b.label.trim())throw Error('Contrast cases must differ');return structuredClone(value);
}
