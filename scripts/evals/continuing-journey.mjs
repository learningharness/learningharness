// Internal synthetic lifecycle check, never packaged as a customer mode.
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createCodexHost} from '../../adapters/codex/src/host.js';
import {LearningEngine} from '../../packages/runtime/src/learning-engine.js';
import {reviewLedger} from '../../packages/learning/src/review-ledger.js';
if(!process.argv.includes('--live'))throw Error('Explicit --live required');
const output=resolve('artifacts/continuing-journey',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(output,{recursive:true});
const report={scope:'synthetic continuing-learning lifecycle',passed:false,calls:[],limitations:['Synthetic past study and clock; not a human retention/skill-gain measure or native acceptance.','No extra quality-judge call; inspect the actual generated review.']};
const directory=await mkdtemp(join(tmpdir(),'lh-continuing-'));let host;
try{
 const sourcePath=process.argv.find(x=>x.startsWith('--source-report='))?.slice(16)??'artifacts/evals/2026-11-10T14-48-27-100Z/learning-value/report.json';
 const source=JSON.parse(await readFile(sourcePath,'utf8')).runs.find(run=>run.dynamicGoal);assert(source?.moment?.lesson);
 report.sourceReport=sourcePath;const original={...structuredClone(source.moment),sessionID:'past'};const originalBytes=JSON.stringify(original);
 const now=new Date(Date.parse(original.createdAt)+2*86400000).toISOString();report.syntheticNow=now;
 host=await createCodexHost({directory});
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},now:()=>now,learningTimeoutMs:90000,capabilities:{host:'codex',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}},defaultLearningModel:{providerID:'codex',modelID:'gpt-6-luna'},gateway:{generate:async input=>{const call={intent:input.intent,prompt:input.prompt};report.calls.push(call);const result=await host.gateway.generate(input);Object.assign(call,{response:result.text,usage:result.usage});return result;}}});
 await engine.load();await engine.command({action:'enable'});engine.state.history=[original];engine.session('past').context={project:'/synthetic/cache',title:'Earlier cache implementation'};
 engine.session('past').evidence=[{id:'synthetic-prior',momentId:original.id,objective:original.objective,verdict:'correct',assisted:true,createdAt:original.createdAt,project:'/synthetic/cache',sessionTitle:'Earlier cache implementation'}];
 engine.session('current').context={project:'/synthetic/ui',title:'Unrelated UI work'};
 engine.session('current').goals={list:[{kind:'core',outcome:original.objective,whyNow:'An unrelated project uses the same topic label',minutes:2}],snapshot:[{id:'new',type:'task.submitted',data:{text:'UNRELATED_CURRENT_WORK'}}]};
 await engine.command({action:'revisit-lesson',sessionID:'current',value:original.id});report.revisit=engine.snapshot('current');assert.equal(report.calls.length,0);assert.deepEqual(engine.session('current').moment.snapshot,original.snapshot);
 await engine.command({action:'refresh-learner',sessionID:'current'});
 const key=engine.snapshot('current').learner.reviews.find(t=>t.objective===original.objective).key;
 await engine.command({action:'review-topic',sessionID:'current',value:key});report.review=engine.snapshot('current');
 assert(report.calls.length>0&&report.calls.length<=2);assert.deepEqual(engine.session('current').moment.snapshot,original.snapshot);assert.equal(engine.session('current').moment.learningContext.project,'/synthetic/cache');assert.equal(engine.session('current').context.project,'/synthetic/ui');assert(report.calls.every(c=>!c.prompt.includes('UNRELATED_CURRENT_WORK')));assert.equal(JSON.stringify(engine.state.history.find(item=>item.id===original.id)),originalBytes);assert.equal(engine.session('current').evidence.length,0);
 const reviewID=engine.session('current').moment.id,count=report.calls.length;await engine.command({action:'review-topic',sessionID:'current',value:key});assert.equal(report.calls.length,count);assert.equal(engine.session('current').moment.id,reviewID);report.repeatedReviewAddedCalls=0;
 const due={...reviewLedger(engine.learnerData.evidence).find(t=>t.key===key),id:'native-review',whyNow:'A due historical concept'};
 const target={id:'prepared-native-review',kind:'review',reviewId:due.id,review:due};engine.session('native').context={project:'/synthetic/unrelated',title:'Another current project'};engine.session('native').reviewOffer=due;
 const beforeNative=report.calls.length;await engine.prepareOpportunity('native',target);const prepared=engine.session('native').preparedLessons[target.id].moment;assert.deepEqual(prepared.snapshot,original.snapshot);assert.equal(prepared.learningContext.project,'/synthetic/cache');assert(report.calls.length-beforeNative<=2);
 const beforeOpen=report.calls.length;await engine.openPreparedOpportunity('native',target);assert.equal(report.calls.length,beforeOpen);report.nativePreparedReview=engine.snapshot('native');report.preparedReviewOpeningAddedCalls=0;
 report.passed=true;report.usage=engine.state.usage;
}catch(error){report.error=String(error.message);process.exitCode=1;}finally{await host?.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{mode:0o600});await rm(directory,{recursive:true,force:true});console.log(JSON.stringify({output,passed:report.passed,error:report.error,calls:report.calls.length}));}
