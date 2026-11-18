import {sourceExcerpts} from '../../packages/learning/src/sources.js';
import {validateCompleteLesson,lessonCodeFocus} from '../../packages/experiences/src/complete-lesson.js';
import {adaptiveGate} from './adaptive-gate.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {learningValueCases,valueCalibration} from './learning-value-cases.mjs';
const execute=promisify(execFile);
export function completeLessonGate(report){
 const valid=report?.kind==='full-prepared-learning-value'&&report.passed===true&&report.calibrationPassed===true&&report.qualityPassed===true&&report.runs?.length===learningValueCases.length;
 return !!valid&&learningValueCases.every(c=>{const r=report.runs.find(x=>x.id===c.id),j=report.judgment?.cases?.find(x=>x.id===c.id);try{validateCompleteLesson(r?.moment?.lesson);}catch{return false;}if(c.dynamicGoal&&(!r.opportunities?.length||r.opportunities[0].outcome!==r.moment.objective||!c.observedFiles.some(file=>r.moment.sourceIds?.includes(file.id)&&r.moment.lesson.sections.some(section=>section.sourceIds?.includes(file.id)&&section.code?.sourceId===file.id&&lessonCodeFocus(section,sourceExcerpts(c.observedFiles,c.observedFiles.length))))))return false;return r?.mechanicsPassed===true&&r.preparedReuse===true&&r.moment?.learningDesign&&r.moment?.question&&r.usage?.calls>0&&r.usage.calls<=2&&j&&!j.issues?.length&&['incremental_value','causal_contrast','expertise_fit','context_honesty','restraint'].every(k=>j.scores?.[k]===2)})&&report.judgment?.examples?.length===valueCalibration.length&&valueCalibration.every(e=>report.judgment.examples.filter(x=>x.id===e.id&&x.classification===e.expected).length===1);
}
export async function runContentGate(directory,run=execute){
 let error;try{await run(process.execPath,['scripts/evals/learning-value.mjs','--live','--output='+directory],{timeout:600000,maxBuffer:1048576});}catch(e){error=String(e.message).slice(0,400);}
 try{const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8'));const lessonsPassed=!error&&completeLessonGate(report);
  let adaptive;if(lessonsPassed){const path=join(directory,'adaptive');try{await run(process.execPath,['scripts/evals/adaptive-flow.mjs','--live','--output='+path],{timeout:600000,maxBuffer:1048576});const evidence=JSON.parse(await readFile(join(path,'report.json'),'utf8'));adaptive={passed:evidence.milestonePassed===true&&adaptiveGate(evidence),path:'learning-value/adaptive/report.json',report:evidence};}catch(e){adaptive={passed:false,error:String(e.message).slice(0,400)};}}
  return {passed:lessonsPassed&&adaptive?.passed===true,path:join(directory,'report.json'),report,adaptive,...(error?{error}:{})};}catch{return {passed:false,path:join(directory,'report.json'),error:error??'Full lesson evidence unavailable'};}
}
