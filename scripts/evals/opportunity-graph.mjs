// Internal synthetic acceptance check; never included in customer plugins.
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createCodexHost} from '../../adapters/codex/src/host.js';
import {LearningEngine} from '../../packages/runtime/src/learning-engine.js';

if(!process.argv.includes('--live'))throw Error('Explicit --live required');
const output=resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)??join('artifacts/opportunity-graph',new Date().toISOString().replace(/[:.]/g,'-')));
await mkdir(output,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'lh-opportunity-graph-'));
const report={kind:'same-call-opportunity-graph',runs:[],hashes:{},limitations:['Synthetic work and profiles; graph interpretations need human inspection. No human mastery, full work coverage, cross-host storage or UI acceptance established.']};
const save=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
let host,engine,saved;
try{
 for(const path of ['packages/learning/src/work-graph.js','packages/runtime/src/learning-engine.js','packages/runtime/src/learning-tools.js','scripts/evals/opportunity-graph.mjs'])report.hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 host=await createCodexHost({directory,stateDirectory:directory});
 const model={providerID:'codex',modelID:(host.catalog.find(m=>m.isDefault)??host.catalog[0]).model};report.model=model;
 const gateway=Object.create(host.gateway);
 gateway.generate=async input=>{
  const run=report.runs.at(-1),call={prompt:input.prompt,intent:input.intent};run.calls.push(call);const at=performance.now();
  try{const result=await host.gateway.generate(input);Object.assign(call,{text:result.text,usage:result.usage});return result;}
  catch(error){call.error=error.message;throw error;}
  finally{call.durationMs=Math.round(performance.now()-at);await save();}
 };
 engine=new LearningEngine({storage:{get:async()=>saved,set:async(_,s)=>{saved=structuredClone(s);}},gateway,defaultLearningModel:model,maxGoalRequests:1,capabilities:{host:'codex',observation:{kinds:['task.submitted','file.changed']},model:{independent:true},surface:{experiments:false}}});
 engine.scheduleParallel=()=>{};
 await engine.load();await engine.command({action:'enable'});
 await engine.openSession('synthetic-graph',{project:directory,title:'Synthetic cache work'});
 const stages=[
  {id:'first-encounter',task:'Implement fixed cache expiry: each entry has a deadline measured from insertion; reads do not extend it.',code:'function expired(entry, now) { return now >= entry.expiresAt; }'},
  {id:'repeat-encounter',task:'Continue the same fixed cache expiry mechanism. Existing deadlines still run from insertion; add a boundary test for now equal to expiresAt.',code:'assert.equal(expired({expiresAt: 60}, 60), true);'},
  {id:'distinct-mechanism',task:'Add tenant isolation to cache keys: identical product IDs in different tenants must not share a cached value.',code:'function cacheKey(tenantId, productId) { return JSON.stringify([tenantId, productId]); }'},
 ];
 for(const fixture of stages){
  const run={...fixture,calls:[]};report.runs.push(run);const before=structuredClone(engine.state.workGraph);
  try{
   await engine.onWorkEvent({id:fixture.id,sessionId:'synthetic-graph',type:'task.submitted',data:{text:fixture.task}});
   await engine.onWorkEvent({id:fixture.id+'-code',sessionId:'synthetic-graph',type:'file.changed',data:{path:'cache.js',content:fixture.code}});
   const opportunity=await engine.generateGoals('synthetic-graph');run.offered=!!opportunity;run.graphUpdate=engine.session('synthetic-graph').graphUpdate;run.graph=structuredClone(engine.state.workGraph);run.assessmentCount=engine.session('synthetic-graph').evidence.length;
   run.addedConcepts=run.graph.concepts.length-before.concepts.length;
   run.reusedConcepts=run.graph.encounters.slice(before.encounters.length).filter(e=>before.concepts.some(c=>c.id===e.conceptId)).length;
   run.passed=run.calls.length===1&&run.graphUpdate.status==='recorded'&&run.assessmentCount===0&&(fixture.id==='repeat-encounter'?run.reusedConcepts>0:run.addedConcepts>0);
  }catch(error){run.error=error.message;run.passed=false;}
  await save();console.log(fixture.id+': '+(run.passed?'PASS':'FAIL'));
 }
 report.passed=report.runs.length===3&&report.runs.every(r=>r.passed);
 if(!report.passed)process.exitCode=1;
}catch(error){report.error=error.message;report.passed=false;process.exitCode=1;}
finally{
 await engine?.command({action:'stop'}).catch(()=>{});await host?.close();await save();await rm(directory,{recursive:true,force:true});console.log(output);
}
