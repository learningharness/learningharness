// Internal end-to-end journey; synthetic replay/answers/clock, never a product mode.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import assert from 'node:assert/strict';
import {createCodexHost} from '../../adapters/codex/src/host.js';
import {LearningEngine} from '../../packages/runtime/src/learning-engine.js';
import {selectedWork} from '../../packages/learning/src/work-selection.js';
import {freezeWork} from '../../packages/learning/src/work-snapshot.js';
if(!process.argv.includes('--live'))throw Error('Explicit --live required');
const arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const phase=arg('phase')??'teach',project=arg('project')??'/private/tmp/lh-customer-journey-claude';
const output=resolve(arg('run')??join('artifacts/connected-work-journey',new Date().toISOString().replace(/[:.]/g,'-')));await mkdir(output,{recursive:true});
const report=phase==='teach'?{scope:'Connected journey from an actual native-built project, replayed internally',passed:false,phases:{},calls:[],stages:[],limitations:['Captured existing cache files and observed tests, replayed as synthetic events; not a fresh native-host journey.','Learner answers and delayed clock are synthetic. No human skill gain, retention or transfer demonstrated.']}:JSON.parse(await readFile(join(output,'report.json'),'utf8'));
if(report.phases[phase]){report.attempts??=[];report.attempts.push({phase,...structuredClone(report.phases[phase])});}
const save=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const directory=await mkdtemp(join(tmpdir(),'lh-connected-live-'));let host,engine;
try{
 host=await createCodexHost({directory});
 const base=host.gateway,model=host.gateway.defaultContextModel??{providerID:'codex',modelID:'gpt-6-luna'};
 const gateway=Object.create(base);gateway.generate=async input=>{const call={phase,intent:input.intent,model:input.model,prompt:input.prompt};report.calls.push(call);const start=performance.now();try{const result=await base.generate(input);Object.assign(call,{response:result.text,usage:result.usage,durationMs:Math.round(performance.now()-start)});return result;}catch(error){call.error=error.message;throw error;}finally{await save();}};
 const statePath=join(output,'state.json');
 const storage={get:async()=>phase==='teach'?null:JSON.parse(await readFile(statePath,'utf8')),set:async(_,state)=>writeFile(statePath,JSON.stringify(state,null,2))};
 let syntheticNow=phase==='teach'?new Date().toISOString():phase==='practice'?report.startedAt:new Date(Date.parse(report.startedAt)+2*86400000).toISOString();
 engine=new LearningEngine({storage,gateway,now:()=>syntheticNow,capabilities:{host:'codex',observation:{kinds:['task.submitted','tool.succeeded']},model:{independent:true},surface:{experiments:false}},defaultLearningModel:model,learningTimeoutMs:90000,maxGoalRequests:1,maxLearningRequests:2,proactiveFollowup:true});engine.scheduleParallel=()=>{};
 await engine.load();await engine.command({action:'enable'});const id='cache-work';
 if(phase==='teach'){
  report.startedAt=syntheticNow;report.project=project;report.sourceHashes={};
  for(const file of ['packages/runtime/src/learning-engine.js','packages/runtime/src/work-journey.js','packages/runtime/src/preparation-prompt.js','packages/experiences/src/journey-plan.js','packages/runtime/src/preparation-schema.js','packages/runtime/src/learning-tools.js','packages/runtime/src/agent-cycle.js','packages/runtime/src/tool-loop.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  report.testOutput=execFileSync('npm',['test'],{cwd:project,encoding:'utf8'});
  await engine.command({action:'enable'});await engine.command({action:'set-limits',value:{session:250000,total:500000}});
  await engine.openSession(id,{project,title:'Own the coalescing cache'});
  await engine.command({action:'save-learner-profile',value:{goals:['Own the code my agent writes: explain its contract, safely change it and choose tests'],known:['Comfortable with JavaScript promises and Map; have read the agent summary but have not reasoned through the implementation'],preferences:'A connected explanation of actual code followed by optional applied reasoning; avoid repeating the summary'}});
  const cache=await readFile(join(project,'cache.js'),'utf8'),tests=await readFile(join(project,'cache.test.js'),'utf8');
  report.files={cache,tests};
  const task={id:'task',type:'task.submitted',data:{text:'Help me own this coalescing cache implementation. Concurrent callers share a load, invalidation prevents stale cache writes without revoking promises, and clear applies across keys. I need to explain and safely change the actual implementation, not just repeat the agent summary.'}};
  const events=[task];
  const capture=(path,content,prefix)=>{let chunk='',i=0;const flush=()=>{if(chunk){events.push({id:`${prefix}-${++i}`,type:'tool.succeeded',capturedAt:syntheticNow,data:{path,output:chunk}});chunk='';}};for(const line of content.split('\n')){if(chunk.length+line.length+1>390)flush();chunk+=line+'\n';}flush();};
  capture('cache.js',cache.slice(cache.indexOf('class CoalescingCache')),'implementation');
  capture('cache.test.js',tests.slice(-350),'rejection-test');
  events.push({id:'observed-tests',type:'tool.succeeded',data:{path:'npm test',output:report.testOutput.slice(-300)}});
  for(const event of events)await engine.onWorkEvent({...event,sessionId:id});
  let offers;
  if(arg('reuse-goal')){const prior=JSON.parse(await readFile(arg('reuse-goal'),'utf8'));offers={list:prior.opportunities,snapshot:freezeWork(selectedWork(engine.workSelection(engine.session(id))))};engine.session(id).goals=offers;report.reusedGoalFrom=arg('reuse-goal');}
  else offers=await engine.generateGoals(id);
  assert(offers?.list?.length,'No learning angle produced');report.opportunities=offers.list;
  const target={id:'connected-start',kind:'goal',goal:offers.list[0],snapshot:offers.snapshot};
  assert(await engine.prepareOpportunity(id,target),'Initial teaching declined');assert.equal(Object.keys(engine.state.journeys??{}).length,0,'Background preparation must not create a learner journey');
  const before=report.calls.length;await engine.openPreparedOpportunity(id,target);assert.equal(report.calls.length,before);report.initialOpeningAddedCalls=0;
  const ref=engine.session(id).moment.journey;assert(ref,'No connected path');report.journeyID=ref.id;report.stages.push(engine.snapshot(id));
  const steps=engine.state.journeys[ref.id].plan.steps;
  for(let index=1;index<steps.length;index++){await engine.command({action:'journey-step',sessionID:id,value:{id:ref.id,index}});report.stages.push(engine.snapshot(id));}
  assert.equal(steps.at(-1).mode,'practice','Journey should end with application');
  report.phases.teach={passed:true,usage:structuredClone(engine.state.usage)};
 }else if(phase==='practice'){
  const answer=await readFile(arg('answer-file'),'utf8');report.syntheticAnswer=answer;report.syntheticNow=syntheticNow;
  if(!engine.session(id).moment.completed)await engine.command({action:'submit',sessionID:id,value:{answer,confidence:'high'}});else assert.equal(engine.session(id).feedback.answer,answer);
  report.assessedPractice=engine.snapshot(id);
  const before=report.calls.length,ref=engine.session(id).moment.journey;
  await engine.command({action:'journey-step',sessionID:'later-chat',value:{id:ref.id,index:0}});
  await engine.command({action:'journey-step',sessionID:'later-chat',value:{id:ref.id,index:ref.index}});
  assert.equal(report.calls.length,before);assert.equal(engine.session('later-chat').feedback.answer,answer);report.reopenAddedCalls=0;
  syntheticNow=new Date(Date.parse(report.startedAt)+2*86400000).toISOString();report.syntheticNow=syntheticNow;
  await engine.command({action:'refresh-learner',sessionID:'later-chat'});
  const topic=engine.snapshot('later-chat').learner.reviews.find(t=>t.objective===engine.session('later-chat').moment.objective);assert(topic,'No spaced review scheduled');
  await engine.command({action:'review-topic',sessionID:'later-chat',value:topic.key});report.delayedReview=engine.snapshot('later-chat');assert.equal(engine.session('later-chat').moment.learningContext.project,engine.state.journeys[ref.id].origin.project);
  const count=report.calls.length;await engine.command({action:'review-topic',sessionID:'later-chat',value:topic.key});assert.equal(report.calls.length,count);
  report.phases.practice={passed:true,usage:structuredClone(engine.state.usage)};
 }else if(phase==='review-answer'){
  const answer=await readFile(arg('answer-file'),'utf8');report.syntheticReviewAnswer=answer;
  await engine.command({action:'submit',sessionID:'later-chat',value:{answer,confidence:'high'}});report.delayedAssessment=engine.snapshot('later-chat');
  const evidence=engine.session('later-chat').evidence.at(-1);assert.equal(evidence.learningEvent.kind,'delayed_review');assert.equal(evidence.learningEvent.delayMs,2*86400000);
  assert.equal(evidence.project,report.delayedReview.session.moment.learningContext.project);report.phases['review-answer']={passed:true,usage:structuredClone(engine.state.usage)};report.passed=true;
 }else throw Error('Unknown phase');
 report.usage=engine.state.usage;
}catch(error){report.phases[phase]={passed:false,error:error.message};report.passed=false;process.exitCode=1;}finally{await host?.close();await save();await rm(directory,{recursive:true,force:true});console.log(JSON.stringify({output,phase,result:report.phases[phase],calls:report.calls.length}));}
