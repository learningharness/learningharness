import {runContentGate} from './content-gate.mjs';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {scenarios,examples} from './cases.mjs';
import {mechanics,judgePrompt,parseJudgment} from './rubric.mjs';
import {createInputRecord,writeReportBundle,renderComparison,readRecentReports} from './report.mjs';
import {startMainAgent} from './main-agent.mjs';
import {createCodexNativeHost} from '../../adapters/codex/src/native-host.js';
import {createSessionContextLoader} from '../../packages/runtime/src/host-session-context.js';
import {CodexObserver} from '../../adapters/codex/src/observer.js';
import {workBrief} from '../../packages/learning/src/work-selection.js';
import {LearningEngine} from '../../packages/runtime/src/learning-engine.js';

const live=process.argv.includes('--live'),fixtures=process.argv.includes('--fixtures');
if(live===fixtures)throw Error('Choose --live (existing subscription) or --fixtures (offline harness check)');
const selectedID=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
const compareExecutors=process.argv.includes('--compare-executors');
const executor=process.argv.find(x=>x.startsWith('--executor='))?.slice(11)??'custom';
if(!['custom','native'].includes(executor)||!live&&(compareExecutors||executor==='native'))throw Error('Native executor comparisons require --live and a supported executor');
const repeats=Number(process.argv.find(x=>x.startsWith('--repeat='))?.slice(9)??1);
if(!Number.isSafeInteger(repeats)||repeats<1||repeats>5)throw Error('Repeat count must be an integer from 1 to 5');
const cases=selectedID?scenarios.filter(s=>s.id===selectedID):scenarios.filter(s=>s.suite==='milestone');
if(!cases.length)throw Error('Unknown evaluation case');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const output=resolve('artifacts/evals',stamp);
await mkdir(output,{recursive:true,mode:0o700});
let revision='unknown',dirty=true;try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}catch{}
const hashes={};for(const path of ['packages/runtime/src/learning-engine.js','packages/runtime/src/learning-tools.js','packages/learning/src/work-graph.js','packages/learning/src/opening-context.js','packages/learning/src/opportunity-policy.js','packages/runtime/src/host-session-context.js','adapters/codex/src/native-host.js','packages/learning/src/tutoring-policy.js','scripts/evals/cases.mjs','packages/runtime/src/tool-loop.js','packages/runtime/src/tool-registry.js','adapters/codex/src/native-tool-cycle.js','adapters/codex/src/model-gateway.js'])hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const report={schema:2,repeats,mode:live?'live':'fixture',createdAt:new Date().toISOString(),revision,dirty,hashes,cases:[],judgment:null,limitations:['Codex transport is the first live eval driver; Claude/OpenCode native delivery still requires separate host checks.','No native nudge visibility or long-term learning outcome is established.','A synthetic profile and selected public activity are used; private reasoning is excluded.']};
report.execution=compareExecutors?{comparison:true,arms:{A:'custom',B:'native'},judgeBlinded:true}:{executor};
if(compareExecutors)report.limitations.push('A/B map is withheld from the quality judge. Coding workers vary; compare fixed-input and actual prompt hashes. Native usage counts host execution calls, not hidden provider requests; its full request allocation is reserved conservatively.');
const save=async()=>{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{mode:0o600});};
let host,workerDirectory;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runCase(scenario,attempt,executionMode){
 const identity={id:compareExecutors?`${scenario.id}#${attempt}/${executionMode==='custom'?'A':'B'}`:repeats>1?`${scenario.id}#${attempt}`:scenario.id,scenarioId:scenario.id,attempt,executionMode,inputs:createInputRecord(scenario)};
 const temporary=await mkdtemp(join(tmpdir(),'dontdumb-eval-'));const workspace=join(temporary,'workspace');await mkdir(workspace);
 for(const [name,body]of Object.entries(scenario.files))await writeFile(join(workspace,name),body);
 const started=performance.now(),samples=[],observerErrors=[],observations=[];let taskAt=null,engine,main,poller,mainStatus='completed';const learningRequests=[];let firstOfferCaptured=false;
 const elapsed=()=>Math.round(performance.now()-started);
 const capture=stage=>{
  const state=engine.snapshot(sessionID);const offered=Boolean(state.session?.goals?.list?.length||state.session?.upcomingGoals?.list?.length);
  const sample={stage,elapsedMs:elapsed(),observedTaskAt:taskAt,state:{enabled:state.enabled,fault:state.fault,session:state.session,learner:state.learner,usage:state.usage}};
  if(samples.length<60||offered&&!firstOfferCaptured)samples.push(sample);else samples[samples.length-1]=sample;
  firstOfferCaptured||=offered;
 };
 let sessionID='fixture';
 try{
  if(live){main=await startMainAgent(workspace,scenario.task,host.catalog.find(m=>m.isDefault)?.model??host.catalog[0].model);sessionID=main.threadID;}
  const fixtureGoals=[{kind:'core',outcome:scenario.id.includes('expert')?'Map cache and storage relationships':'How concurrent writes stay safe',whyNow:scenario.id.includes('expert')?'This connects to your request-path goal; the actual repo relationships need the coding agent’s explanation.':'Your persistence goal meets the store’s read/merge/write boundary.',minutes:3,insight:'Replacing a file atomically avoids partial reads; serializing read/merge/write prevents lost updates.',path:['Persistence','Concurrency'],...(scenario.id.includes('expert')?{contextNeeded:true}:{})}];
  const baseGateway=live?host.gateway:{generate:async()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:fixtureGoals},reason:'Deterministic harness check'}),usage:{input:30,output:30}})};
  const gateway=Object.create(baseGateway);
  gateway.generate=async input=>{
   const record={intent:input.intent,model:input.model,role:input.role,prompt:input.prompt,atMs:elapsed(),executionMode:input.execution?'native':'custom'};learningRequests.push(record);
   if(input.execution){
    const original=input.execution.registry;record.nativeTools=original.describe();record.toolCalls=[];record.events=[];
    input={...input,execution:{...input.execution,onEvent:event=>record.events.push({atMs:elapsed(),...event}),registry:{describe:()=>original.describe(),execute:async(choice,api)=>{const call={atMs:elapsed(),...structuredClone(choice)};record.toolCalls.push(call);try{const result=await original.execute(choice,api);call.result=structuredClone(result);return result;}catch(error){call.error=String(error.message).slice(0,400);throw error;}}}}};
   }
   try{const result=await baseGateway.generate(input);Object.assign(record,{response:result.text,usage:result.usage,completedMs:elapsed(),...(result.cycle?{nativeCycle:result.cycle}:{}),...(result.executionError?{error:result.executionError.message,reportedUsage:result.reportedUsage}:{} )});return result;}catch(error){Object.assign(record,{error:String(error.message).slice(0,400),failedMs:elapsed()});throw error;}
  };
  engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway,executionMode,capabilities:{host:'codex',observation:{kinds:['task.submitted','assistant.ended','file.changed','tool.succeeded','tool.failed']},model:{independent:true},surface:{experiments:true}},defaultLearningModel:{providerID:'codex',modelID:live?(host.catalog.find(m=>m.isDefault)??host.catalog[0]).model:'fixture'},proactiveFollowup:true, automaticMinIntervalMs:120000, maxAutomaticChecksPerWindow:3, automaticWindowMs:600000,maxAutomaticChecksPerTask:2,maxGoalRequests:2,maxLearningRequests:3,debounceMs:live?600:0,emit:async(name,data)=>{if(name==='updated'&&data.sessionID===sessionID)capture(data.reason);}});
  await engine.load();await engine.command({action:'save-learner-profile',value:scenario.profile});await engine.command({action:'enable'});await engine.openSession(sessionID,{title:scenario.title,project:workspace});capture('session-open');
  const ensureContext=live?createSessionContextLoader({host,engine}):null;
  const observe=async event=>{if(ensureContext)await ensureContext(event.sessionId);if(event.type==='task.submitted'&&taskAt===null)taskAt=elapsed();observations.push({atMs:elapsed(),...event});await engine.onWorkEvent(event);if(event.type==='file.changed')capture('file-milestone');};
  if(live){
   const observer=new CodexObserver({rpc:main.rpc,onEvent:observe,getTaskId:id=>engine.session(id).workSelection?.task?.id});observer.attach(sessionID);
   poller=setInterval(()=>{void observer.poll().catch(()=>observerErrors.push('Public-work observer failed'));},1500);
   await main.start();mainStatus=await main.done;while(observer.running)await wait(25);await observer.poll();
  }else{
   await observe({id:'task',sessionId:sessionID,type:'task.submitted',data:{text:scenario.task}});await engine.consider(sessionID);
   await observe({id:'file',sessionId:sessionID,type:'file.changed',data:{path:'store.mjs',diff:'+ serialized write queue; atomic replacement'}});await engine.consider(sessionID);
  }
  // Let only already scheduled, bounded opportunities settle after the coding turn.
  // A future cooldown wake-up is not an active request. Its admission and
  // cancellation are exercised separately; don't wait for it in this case.
  const runnableTimer=()=>[...engine.parallelTimers.keys()].some(id=>!engine.proactiveFollowup||engine.automaticCheckDue(engine.session(id),engine.workSelection(engine.session(id))));
  const until=performance.now()+engine.opportunityTimeoutMs+2000;
  while(performance.now()<until&&(engine.inflight.size||engine.considerations.size||runnableTimer()))await wait(100);
  capture('final');
  const state=engine.snapshot(sessionID),checks=mechanics({samples,usage:state.usage,observerErrors,mainStatus,mode:report.mode,requestCount:learningRequests.length});
  return {...identity,title:scenario.title,task:scenario.task,profile:scenario.profile,expectations:scenario.expectations,checks,mainStatus,mainUsage:main?.usage()??null,observerErrors,observations,samples,learningRequests,contextDelivery:'Copy-and-send request only; no automatic request into main coding chat'};
 }catch(error){return{...identity,title:scenario.title,task:scenario.task,profile:scenario.profile,expectations:scenario.expectations,checks:{passed:false,failures:[String(error.message).slice(0,400)]},samples,observations,observerErrors,learningRequests};}
 finally{clearInterval(poller);if(engine){for(const timer of engine.parallelTimers.values())clearTimeout(timer);await engine.command({action:'stop'}).catch(()=>{});}await main?.close();await rm(temporary,{recursive:true,force:true});}
}
async function judge(data){
 const model=(host.catalog.find(m=>m.isDefault)??host.catalog[0]).model;let timer;const started=performance.now();
 report.judgeTrace={model,prompt:judgePrompt(data),startedAt:new Date().toISOString()};await save();
 try{
  const result=await Promise.race([
   host.gateway.generate({role:'orchestrator',intent:'eval',parentSessionId:'internal-eval-judge',model:{providerID:'codex',modelID:model},prompt:report.judgeTrace.prompt,onPrepared:async()=>{}}),
   new Promise((_,reject)=>{timer=setTimeout(()=>{void host.gateway.cancel('internal-eval-judge').catch(()=>{});reject(Error('Eval judge timed out'));},45000);})
  ]);
  Object.assign(report.judgeTrace,{response:result.text,usage:result.usage});await save();
  return parseJudgment(result.text,report.cases.map(s=>s.id),examples);
 }catch(error){report.judgeTrace.error=String(error.message).slice(0,400);throw error;}
 finally{clearTimeout(timer);report.judgeTrace.durationMs=Math.round(performance.now()-started);await save();}
}
await save();
try{
 if(live){workerDirectory=await mkdtemp(join(tmpdir(),'dontdumb-eval-worker-'));host=await createCodexNativeHost({directory:workerDirectory});}
 for(const scenario of cases)for(let attempt=1;attempt<=repeats;attempt++)for(const executionMode of compareExecutors?(attempt%2?['custom','native']:['native','custom']):[executor]){console.log(`Running ${scenario.id}, attempt ${attempt}/${repeats} (${report.mode}, ${executionMode})`);report.cases.push(await runCase(scenario,attempt,executionMode));await save();}
 if(live&&report.cases.every(c=>c.observations?.length)){
  const data={examples:examples.map(({expected,why,...value})=>value),cases:report.cases.map(c=>({id:c.id,task:c.task,profile:c.profile,expectations:c.expectations,checks:c.checks,contextDelivery:c.contextDelivery,observations:workBrief(c.observations??[],2400),samples:c.samples.filter((s,i,all)=>i===0||i===all.length-1||s.stage==='goals'||s.stage==='new-opportunity').slice(0,8).map(s=>({stage:s.stage,elapsedMs:s.elapsedMs,goals:s.state.session?.upcomingGoals??s.state.session?.goals,profile:s.state.learner?.profile,fault:s.state.fault}))}))};
  try{report.judgment=await judge(data);}catch(error){report.judgeError=String(error.message).slice(0,400);}
 }
 report.passed=report.cases.every(c=>c.checks.passed)&&(!live||report.judgment?.calibrated&&report.judgment.cases.every(c=>c.passed));
 const fullGate=live&&!selectedID&&!compareExecutors&&!process.argv.includes('--offers-only');
 report.scope=fullGate?'offers-and-complete-lessons':'diagnostic-offers-only';
 if(fullGate){console.log('Running complete lesson quality gate');const result=await runContentGate(join(output,'learning-value'));report.fullLessons={passed:result.passed,path:'learning-value/report.json',error:result.error,adaptive:result.adaptive?{passed:result.adaptive.passed,path:result.adaptive.path,error:result.adaptive.error,runs:result.adaptive.report?.runs?.map(r=>({id:r.id,mechanicsPassed:r.mechanicsPassed,usage:r.usage})),judgeUsage:result.adaptive.report?.judge?.usage}:null,cases:result.report?.runs?.map(r=>({id:r.id,usage:r.usage,durationMs:r.durationMs,mechanicsPassed:r.mechanicsPassed})),judgeUsage:result.report?.judge?.usage};report.passed=report.passed&&result.passed;}
 report.milestonePassed=fullGate&&report.passed;
 report.qualityStatus=live?(report.judgment?.calibrated?'judged':'untrusted-or-unavailable-judge'):'not-run';
 report.tokenUsage={main:report.cases.map(c=>({case:c.id,usage:c.mainUsage??null})),learning:report.cases.map(c=>({case:c.id,usage:c.checks.usage??null})),judge:report.judgeTrace?.usage??null,fullLessons:report.fullLessons??null};
 await save();
 await writeReportBundle(report,output);
 const path=join(output,'report.json'),previous=await readRecentReports(dirname(output),report.mode,path);
 await writeFile(join(output,'comparison.md'),renderComparison([...previous,{report,path}]),{mode:0o600});
 console.log(`Report: ${join(output,'report.md')}`);if(!report.passed)process.exitCode=1;
}catch(error){report.fatalError=String(error.message).slice(0,400);report.passed=false;await save();await writeReportBundle(report,output);console.log(`Report: ${join(output,'report.md')}`);process.exitCode=1;}finally{await host?.close();if(workerDirectory)await rm(workerDirectory,{recursive:true,force:true});}
