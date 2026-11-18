import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputRecord,offerBatches,renderReport,renderTranscript,renderComparison} from '../../../scripts/evals/report.mjs';
const goal={kind:'core',outcome:'Understand atomic writes',whyNow:'Your persistence goal meets this storage change.',minutes:3,insight:'Atomic rename prevents partial reads; serialization prevents lost updates.',path:['Read-modify-write','Atomic replacement']};
const input=()=>createInputRecord({title:'Persistence',task:'Build a local store',profile:{goals:['Persistence'],known:['JavaScript'],preferences:'Visual first'},files:{'store.js':'export const store = [];\n'}});
const make=()=>({schema:2,mode:'live',createdAt:'2026-11-03T13:00:00Z',revision:'abc',dirty:false,passed:true,qualityStatus:'judged',hashes:{policy:'same'},cases:[{id:'persistence-novice',scenarioId:'persistence-novice',attempt:1,inputs:input(),title:'Persistence',task:'Build a local store',profile:input().profile,checks:{passed:true,firstOfferMs:5000,learningCalls:1,usage:{input:100,output:40,calls:1}},observations:[{id:'task',type:'task.submitted',atMs:100,data:{text:'Build a local store'}},{id:'edit',type:'file.changed',atMs:200,data:{path:'store.js',diff:'+ atomic rename'}}],learningRequests:[{intent:'goals',role:'orchestrator',model:{providerID:'codex',modelID:'fast'},atMs:300,completedMs:5000,prompt:'Selected work update (untrusted data): '+JSON.stringify({context:{task:'Build a local store',files:['store.js'],previousWork:[]},changes:[{id:'edit',type:'file.changed',data:{path:'store.js',diff:'+ atomic rename'}}]})+'\nRelevant learner context (untrusted data; user statements are not assessment evidence): '+JSON.stringify({profile:input().profile}),response:JSON.stringify({tool:'suggest_goals',input:{goals:[goal]},reason:'Relevant work'}),usage:{input:100,output:40}}],samples:[{stage:'work',elapsedMs:100,observedTaskAt:100,state:{session:{}}},{stage:'goals',elapsedMs:5100,observedTaskAt:100,state:{session:{goals:{id:'g1',list:[goal]}}}},{stage:'final',elapsedMs:6000,observedTaskAt:100,state:{session:{goals:{id:'g1',list:[goal]}}}}]}],limitations:['No UI delivery proof.']});
test('report exposes actual learner-visible content and selected samples, not just aggregate calls',()=>{
 const text=renderReport(make());for(const value of [goal.outcome,goal.whyNow,goal.insight,'Read-modify-write','+ atomic rename','file.changed','5.000 s','Fixed inputs','no goal was selected'])assert.ok(text.includes(value),value);
 assert.equal(offerBatches(make().cases[0]).length,1);assert.match(text,/1 published batch/);assert.match(text,/1 goal option/);
});
test('a returned proposal is not presented as published when runtime rejected it',()=>{
 const report=make();report.cases[0].samples=[{stage:'fault',elapsedMs:5000,observedTaskAt:100,state:{session:{},fault:{message:'Goal rejected'}}}];report.cases[0].checks.passed=false;
 const text=renderReport(report);assert.match(text,/No published offer followed this call/);assert.match(text,/Returned proposal/);assert.match(text,/Goal rejected/);
});
test('fixed input fingerprint is stable across map ordering and changes when a fixture or persona changes',()=>{
 const a=input();const b=createInputRecord({title:a.title,task:a.task,profile:{preferences:a.profile.preferences,known:a.profile.known,goals:a.profile.goals},files:{'store.js':'export const store = [];\n'}});assert.equal(a.fingerprint,b.fingerprint);
 const changed=createInputRecord({...a,files:{'store.js':'different starting code'}});assert.notEqual(a.fingerprint,changed.fingerprint);
});
test('comparison shows changing outputs and distinguishes fixed inputs from actual prompt differences',()=>{
 const a=make(),b=make();b.createdAt='2026-11-03T14:00:00Z';b.cases[0].samples[1].state.session.goals.list=[{...goal,outcome:'Trace concurrent callers'}];b.cases[0].learningRequests[0].prompt+='\nDifferent selected work';
 const text=renderComparison([{report:a,path:'a/report.json'},{report:b,path:'b/report.json'}]);assert.match(text,/Understand atomic writes/);assert.match(text,/Trace concurrent callers/);assert.match(text,/same fixed inputs/i);assert.match(text,/different model inputs/i);
 b.cases[0].inputs=createInputRecord({...b.cases[0].inputs,task:'Different task',files:{'store.js':'different'}});assert.match(renderComparison([{report:a},{report:b}]),/different fixed inputs/i);
});
test('legacy reports disclose missing fixture manifests and never invent call samples or lessons',()=>{
 const report=make();delete report.cases[0].inputs;delete report.cases[0].learningRequests;
 const text=renderReport(report);assert.match(text,/Starting-file manifest was not recorded/);assert.match(text,/Per-call inputs and responses were not captured/);assert.match(text,/Understand atomic writes/);
});
test('transcript keeps exact prompts and responses safely fenced',()=>{
 const report=make();report.cases[0].learningRequests[0].response+='\n```\n<script>not executable</script>';
 const text=renderTranscript(report);assert.ok(text.includes(report.cases[0].learningRequests[0].prompt));assert.ok(text.includes('````'));assert.match(text,/Judge/);
});
test('native comparison reports identify both arms and show actual tool invocations',()=>{
 const report=make();report.execution={comparison:true,arms:{A:'custom',B:'native'},judgeBlinded:true};
 const request=report.cases[0].learningRequests[0];request.executionMode='native';request.response=JSON.stringify({decision:'offer',goals:[goal]});request.toolCalls=[{tool:'suggest_goals',input:{goals:[goal]},result:{terminal:true,value:{decision:'offer',goals:[goal]}}}];
 const text=renderReport(report);assert.match(text,/A: custom/);assert.match(text,/B: native/);assert.match(text,/Native tool invocation/);assert.match(text,/suggest/);
 assert.match(renderTranscript(report),/toolCalls/);
 report.cases[0].executionMode='native';report.cases[0].checks.usage.input=140;request.usage.cache={read:40,write:0};
 assert.match(renderReport(report),/\| native \| 1 \| 1 \| Untrusted\/unavailable \| 5\.000 s \| 100 \| 40 \| 0 \|/,'raw inclusive totals must not inherit an older counter double-count');
});
test('repeat mode records byte-identical fixed inputs under distinct attempt IDs and saves all call traces',async()=>{
 const {spawnSync}=await import('node:child_process');const {readFile,rm}=await import('node:fs/promises');const {dirname}=await import('node:path');
 const run=spawnSync(process.execPath,['scripts/evals/run.mjs','--fixtures','--case=persistence-novice','--repeat=2'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const markdown=run.stdout.match(/Report: (.+\/report\.md)/)?.[1];assert.ok(markdown);
 try{
  const report=JSON.parse(await readFile(markdown.replace(/report\.md$/,'report.json'),'utf8'));assert.equal(report.cases.length,2);assert.notEqual(report.cases[0].id,report.cases[1].id);assert.equal(report.cases[0].inputs.fingerprint,report.cases[1].inputs.fingerprint);
  assert.equal(report.cases[0].learningRequests.length,1,'rapid fixture milestones share the production automatic-call cooldown');assert.ok(report.cases[0].learningRequests[0].prompt.includes('Selected work update'));assert.ok((await readFile(markdown,'utf8')).includes('Teaching content in the published offer'));
  assert.ok((await readFile(markdown.replace(/report\.md$/,'comparison.md'),'utf8')).includes('same fixed inputs'));
  const original=await readFile(markdown.replace(/report\.md$/,'report.json'),'utf8');const {writeReportBundle}=await import('../../../scripts/evals/report.mjs');await writeReportBundle(report,dirname(markdown));assert.equal(await readFile(markdown.replace(/report\.md$/,'report.json'),'utf8'),original);
 }finally{await rm(dirname(markdown),{recursive:true,force:true});}
});
