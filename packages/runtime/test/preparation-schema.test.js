import test from 'node:test';import assert from 'node:assert/strict';
import {preparationResponseSchema,omitOptionalNulls,unwrapPreparedCall} from '../src/preparation-schema.js';
import {createLearningTools} from '../src/learning-tools.js';
import {runToolLoop} from '../src/tool-loop.js';
test('preparation offers bounded structured tools without arbitrary presentation objects',()=>{
 const registry=createLearningTools({preparing:true});const schema=preparationResponseSchema(registry);const variants=schema.properties.call.anyOf;const names=variants.map(v=>v.properties.tool.enum[0]);
 assert(names.includes('teach'));assert(!names.includes('present'));assert(!names.includes('present_flashcard'));assert(!names.includes('build_interactive'));
 const teach=variants.find(v=>v.properties.tool.enum[0]==='teach').properties.input;assert.equal(teach.properties.body.maxLength,280);assert(teach.required.includes('lesson'));assert.equal(teach.properties.lesson.anyOf[1].type,'null');
 const section=teach.properties.lesson.anyOf[0].properties.sections.items;assert(section.required.includes('code'));assert.equal(section.properties.body.maxLength,600);
});
test('initial plan is required at generation; subsequent teaching cannot silently replan',()=>{
 const initial=preparationResponseSchema(createLearningTools({preparing:true,planJourney:true})).properties.call.anyOf.find(v=>v.properties.tool.enum[0]==='teach').properties.input.properties.lesson;
 assert(initial.anyOf[0].properties.journey.properties.steps);assert(initial.anyOf[0].required.includes('journey'));
 const later=preparationResponseSchema(createLearningTools({preparing:true})).properties.call.anyOf.find(v=>v.properties.tool.enum[0]==='teach').properties.input.properties.lesson;
 assert.equal(later.anyOf[0].properties.journey,undefined);
 const review=preparationResponseSchema(createLearningTools({preparing:true,reviewOnly:true}));assert(review.properties.call.anyOf.some(v=>v.properties.tool.enum[0]==='present_flashcard'));assert(!review.properties.call.anyOf.some(v=>v.properties.tool.enum[0]==='teach'));
});
test('a future delayed review cannot be claimed as already observed learner evidence',()=>{
 const kinds=learner=>preparationResponseSchema(createLearningTools({preparing:true,reviewOnly:true,learner})).properties.call.anyOf.find(v=>v.properties.tool.enum[0]==='present_flashcard').properties.input.properties.learningDesign.properties.basis.properties.kind.enum;
 assert(!kinds([{id:'prior',verdict:'correct',learningEvent:{kind:'immediate_practice'}}]).includes('delayed_review'));
 assert(kinds([{id:'prior',verdict:'correct',learningEvent:{kind:'immediate_practice'}}]).includes('unassisted_practice'));
 assert(kinds([{id:'prior',verdict:'correct',learningEvent:{kind:'delayed_review',delayMs:86400000}}]).includes('delayed_review'));
});
test('nullable output optionals normalize only where the registered schema permits omission',()=>{
 const schema={type:'object',required:['body'],properties:{body:{type:'string'},code:{type:'object',required:['quote'],properties:{quote:{type:'string'},note:{type:'string'}}},items:{type:'array',items:{type:'object',properties:{hint:{type:'string'}}}}}};
 assert.deepEqual(omitOptionalNulls({body:null,code:null,unknown:null,items:[{hint:null}]},schema),{body:null,unknown:null,items:[{}]});
 assert.deepEqual(omitOptionalNulls({body:'x',code:{quote:'a',note:null}},schema),{body:'x',code:{quote:'a'}});
});
test('prepared name and input are paired and the envelope retains execution validation',async()=>{
 const registry=createLearningTools({preparing:true,practiceOnly:true,validateExperience:x=>x});const schema=preparationResponseSchema(registry);
 const variants=schema.properties.call.anyOf;const teach=variants.find(v=>v.properties.tool.enum[0]==='teach');assert(!teach.properties.input.properties.ids);assert(!teach.properties.input.properties.reason);
 const design={version:1,newAbility:'Explain the boundary',distinction:{left:'Caller',right:'Cache'},addsBeyond:'A new order',capability:'explain',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
 const call={tool:'teach',reason:'Teach the selected mechanism',input:{title:'A boundary',objective:'Explain ownership',relevance:'The cache work',body:'Only the current owner may publish.',question:'Why is completion insufficient?',rubric:'Ownership may have changed.',hook:'Explore the cache ownership boundary',sourceIds:[],learningDesign:design,lesson:null,sibling:null,deeper:null,comparison:null,flow:null}};
 let calls=0;const result=await runToolLoop({registry,compactContracts:true,responseSchema:schema,maxRequests:1,request:async prompt=>{calls++;assert.match(prompt,/STRUCTURED PREPARATION OUTPUT/);return JSON.stringify({call});}});
 assert.equal(calls,1);assert.equal(result.value.experience.body,call.input.body);assert.equal(result.value.experience.lesson,undefined);
 assert.throws(()=>unwrapPreparedCall({call,extra:true},schema),/one call envelope/);
 await assert.rejects(runToolLoop({registry,compactContracts:true,responseSchema:schema,maxRequests:1,request:async()=>JSON.stringify({call:{...call,input:{ids:[]}}})}),/missing|unknown/);
});
