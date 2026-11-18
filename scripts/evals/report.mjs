import {createHash} from 'node:crypto';
import {writeFile,readdir,readFile} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(canonical(value))).digest('hex');
const inline=value=>String(value??'Unavailable').replace(/[\\`*_[\]<>|]/g,'\\$&').replace(/\n/g,' ');
const seconds=value=>Number.isFinite(value)?`${(value/1000).toFixed(3)} s`:'Unavailable';
const verdict=value=>value===true?'PASS':value===false?'FAIL':'Not evaluated';
const json=value=>JSON.stringify(value??null,null,2);
function fence(value,language='text'){
  const text=String(value??'Not captured');
  const longest=Math.max(0,...(text.match(/`+/g)??[]).map(run=>run.length));
  const delimiter='`'.repeat(Math.max(3,longest+1));
  return `${delimiter}${language}\n${text}\n${delimiter}`;
}
function table(headers,rows){
  return [headers,headers.map(()=> '---'),...rows].map(row=>'| '+row.map(inline).join(' | ')+' |').join('\n');
}
const list=values=>(values?.length?values.map(value=>'- '+inline(value)).join('\n'):'None recorded.');
const sourceCounts=values=>Object.entries((values??[]).reduce((counts,item)=>({...counts,[item.type??'unknown']:(counts[item.type??'unknown']??0)+1}),{}));
const caseName=c=>c.scenarioId??c.id?.replace(/#\d+$/,'');
const modelName=q=>[q.model?.providerID,q.model?.modelID].filter(Boolean).join('/')||'Not captured';

export function createInputRecord(scenario){
  const files=Object.entries(scenario.files??{}).sort(([a],[b])=>a.localeCompare(b)).map(([path,content])=>({path,content,bytes:Buffer.byteLength(content),sha256:hash(content)}));
  const value={title:scenario.title,task:scenario.task,profile:scenario.profile,files};
  return {...value,fingerprint:hash({...value,files:files.map(({path,sha256})=>({path,sha256}))})};
}
const coarseInputs=c=>({title:c.inputs?.title??c.title,task:c.inputs?.task??c.task,profile:c.inputs?.profile??c.profile});
function fixedInputsMatch(a,b){
  if(hash(coarseInputs(a))!==hash(coarseInputs(b)))return 'different fixed inputs';
  if(a.inputs?.files&&b.inputs?.files)return a.inputs.fingerprint===b.inputs.fingerprint?'same fixed inputs':'different fixed inputs';
  return 'same recorded task/profile/title; fixture manifest unavailable';
}
function readPromptJSON(prompt,marker){
  const line=String(prompt??'').split('\n').find(line=>line.startsWith(marker));
  if(!line)return null;
  try{return JSON.parse(line.slice(marker.length).trim());}catch{return null;}
}
export function offerBatches(c){
  const seen=new Set(),batches=[];
  for(const sample of c.samples??[]){
    for(const goals of [sample.state?.session?.goals,sample.state?.session?.upcomingGoals]){
      if(!goals?.list?.length)continue;
      const id=goals.id??hash(goals.list);
      if(seen.has(id))continue;
      seen.add(id);batches.push({id,stage:sample.stage,elapsedMs:sample.elapsedMs,observedTaskAt:sample.observedTaskAt,goals:goals.list});
    }
  }
  return batches;
}
function rawProposal(request){
  if(request.executionMode==='native')return request.toolCalls?.filter(call=>call.result?.terminal).at(-1)??request.toolCalls?.at(-1)??null;
  try{return JSON.parse(request.response.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{return null;}
}
function renderGoals(goals){
  return goals.map((goal,index)=>[
    `##### ${index+1}. ${inline(goal.outcome)}`,
    `${inline(goal.kind)} · ${inline(goal.minutes)} min`,
    `**Why now:** ${inline(goal.whyNow)}`,
    `**Teaching content in the published offer:** ${inline(goal.insight||'No immediate teaching content recorded.')}`,
    `**Suggested learning path:** ${goal.path?.length?goal.path.map(inline).join(' → '):'Not recorded.'}`,
    `**Delivery route:** ${goal.contextNeeded?'Prepare an explanation request for the learner to review and copy; no automatic send.':'Explore using the captured context.'}`
  ].join('\n\n')).join('\n\n');
}
function renderSources(sources){
  if(!sources?.length)return 'None in this packet.';
  return sources.map((source,index)=>{
    const data=source.data??{};
    const lines=[`**Sample ${index+1}: ${inline(source.type)}**${data.path?` — ${inline(data.path)}`:''}`,`Source ID: ${inline(source.id??'Not recorded')}`];
    let shown=false;
    for(const key of ['command','text','diff','patch','content','output','result','error','input']){
      if(data[key]==null)continue;
      lines.push(`${key}:`,fence(typeof data[key]==='string'?data[key]:json(data[key])));shown=true;
    }
    if(!shown)lines.push(fence(json(data),'json'));
    return lines.join('\n\n');
  }).join('\n\n');
}
function renderCall(c,request,index,batches){
  const next=(c.learningRequests??[])[index+1];
  const published=batches.filter(batch=>batch.elapsedMs>=request.atMs&&(!next||batch.elapsedMs<next.atMs));
  const proposal=rawProposal(request);
  const packet=readPromptJSON(request.prompt,'Selected work update (untrusted data):');
  const learner=readPromptJSON(request.prompt,'Relevant learner context (untrusted data; user statements are not assessment evidence):');
  const end=request.completedMs??request.failedMs;
  const lines=[`#### Learning call ${index+1} — ${inline(request.intent)}`,
    table(['Model / role','Started after case start','Duration','Input tokens','Output tokens','Usage'],[[`${modelName(request)} / ${request.role??'unknown'}`,seconds(request.atMs),Number.isFinite(end)?seconds(end-request.atMs):'Not recorded',request.usage?.input??'Unknown',request.usage?.output??'Unknown',request.usage?request.usage.estimated?'Estimated':'Measured':'Unreported']]),
    `**Exact prompt SHA-256:** \`${hash(request.prompt??'')}\``,
    `**${request.executionMode==='native'?'Native tool invocation':'Returned proposal'}:** ${inline(proposal?.tool??(request.error?'Request failed':'Not decodable / not captured'))}${proposal?.input?.goals?`; ${proposal.input.goals.length} proposed goal options`:''}.`,
    request.error?`**Request error:** ${inline(request.error)}`:'',
    request.reportedUsage?`**Reported partial usage (not settled as a complete bill):** ${request.reportedUsage.input} input / ${request.reportedUsage.output} output tokens.`:'',
    packet?'**Actual sampled inputs sent to this call**':'**Actual sampled inputs:** structured work packet was not captured; inspect the exact prompt in [transcript.md](transcript.md).'
  ];
  if(packet){
    lines.push(`Explicit task: ${packet.context?.task===(c.inputs?.task??c.task)?'Matches the fixed task above.':'Differs from / is a bounded excerpt of the fixed task:'}`);
    if(packet.context?.task!==(c.inputs?.task??c.task))lines.push(fence(packet.context?.task));
    lines.push(`Current change excerpts: **${packet.changes?.length??0}**. Prior-work excerpts: **${packet.context?.previousWork?.length??0}**.`,
      `Session title supplied: ${inline(packet.context?.sessionTitle??'Not recorded')}. Evidence stage: ${inline(packet.context?.stage??'Not recorded')}.`,
      '**Current change excerpts:**',renderSources(packet.changes),
      '**Prior-work excerpts (continuity, not new evidence):**',renderSources(packet.context?.previousWork));
    if(packet.context?.previousGoals?.length)lines.push('**Prior suggestions supplied for continuity:**',list(packet.context.previousGoals));
  }
  if(learner){
    lines.push('**Learner context actually supplied:**',
      `Goals: ${inline((learner.profile?.goals??[]).join('; ')||'None')}. Stated knowledge: ${inline((learner.profile?.known??[]).join('; ')||'None')}. Preferences: ${inline(learner.profile?.preferences||'None')}.`,
      `Prior topic beliefs: ${learner.topics?.length??0}; recent attempts: ${learner.recent?.length??0}; recently explored topics: ${learner.recentlyExplored?.length??0}.`);
    if(learner.topics?.length||learner.recent?.length)lines.push(fence(json({topics:learner.topics,recent:learner.recent}),'json'));
  }
  if(published.length){
    for(const batch of published)lines.push(`**Published batch at ${seconds(batch.elapsedMs)} after case start** (${seconds(batch.elapsedMs-batch.observedTaskAt)} after the task was observed):`,renderGoals(batch.goals));
  }else lines.push('**Outcome: No published offer followed this call in the saved samples.** A model response alone does not count as a delivered offer.');
  const faults=(c.samples??[]).filter(s=>s.elapsedMs>=request.atMs&&(!next||s.elapsedMs<next.atMs)&&s.state?.fault);
  const messages=[...new Set(faults.map(s=>s.state.fault.message).filter(Boolean))];
  if(messages.length)lines.push('**Runtime outcomes / errors in this interval:**',list(messages));
  return lines.filter(Boolean).join('\n\n');
}
function renderLessons(c){
  const moments=new Map();
  for(const sample of c.samples??[]){
    const moment=sample.state?.session?.moment;
    if(moment?.id)moments.set(moment.id,{...moment,feedback:sample.state.session.feedback});
  }
  if(!moments.size)return '**Teaching after selection was not exercised:** no goal was selected in this run. The content above is the actual offer-card teaching content, not a completed lesson, interactive or assessment.';
  return [...moments.values()].map(moment=>[`#### ${inline(moment.title)}`,fence(moment.body),`Question: ${inline(moment.question||'None')}`,moment.feedback?fence(json(moment.feedback),'json'):'No assessment feedback recorded.'].join('\n\n')).join('\n\n');
}
function renderCase(report,c){
  const batches=offerBatches(c),profile=c.inputs?.profile??c.profile??{},calls=c.learningRequests??[];
  const taskAt=c.samples?.find(s=>Number.isFinite(s.observedTaskAt))?.observedTaskAt;
  const judge=report.judgment?.cases?.find(item=>item.id===c.id);
  const lines=[`## ${inline(c.id)}`,'### Fixed inputs',
    `Title: ${inline(c.inputs?.title??c.title??'Not recorded')}. Attempt: ${c.attempt??1}.`,
    `**Task:**\n\n${fence(c.inputs?.task??c.task)}`,
    '**Learner goals:**\n\n'+list(profile.goals),'**Stated knowledge:**\n\n'+list(profile.known),
    `**Preferences:** ${inline(profile.preferences||'None stated')}`,
    `**Task/profile/title fingerprint:** \`${hash(coarseInputs(c))}\``
  ];
  if(c.inputs?.files){
    lines.push(`**Full fixed-input fingerprint (including starting-file hashes):** \`${c.inputs.fingerprint}\``,table(['Starting file','Bytes','SHA-256'],c.inputs.files.map(f=>[f.path,f.bytes,f.sha256])),'Starting-file contents are in [transcript.md](transcript.md). They are available to the coding worker; the learner receives only its sampled inputs below.');
  }else lines.push('Starting-file manifest was not recorded in this older run; do not assume byte-identical fixtures solely from its case name.');
  lines.push('### What happened',
    `${batches.length} published batch${batches.length===1?'':'es'}; ${batches.reduce((n,b)=>n+b.goals.length,0)} goal option${batches.reduce((n,b)=>n+b.goals.length,0)===1?'':'s'} across those updates. A batch seen again during polling is counted once.`,
    `First task observed: **${seconds(taskAt)}** after case start. First published offer: **${seconds(batches[0]?.elapsedMs)}** after case start. Measured offer delay: **${seconds(c.checks?.firstOfferMs)}** from task observation.`,
    `Recorded learning calls: **${c.learningRequests?calls.length:c.checks?.learningCalls??'Unknown'}**. Runtime: **${verdict(c.checks?.passed)}**. Quality: **${verdict(judge?.passed)}**.`,
    '**Observed public event types** (not every stream token):',table(['Event type','Count'],sourceCounts(c.observations)),
    '**Milestone timeline** (long entries abbreviated; full text is preserved in the call samples and transcript):',table(['Case time','Milestone','Detail'],[
      ...(c.observations??[]).map(o=>[o.atMs,o.type,o.data?.path??o.data?.command??o.data?.text??'Public tool result']),
      ...calls.map((q,i)=>[q.atMs,`learning call ${i+1}`,modelName(q)]),
      ...batches.map((b,i)=>[b.elapsedMs,`published batch ${i+1}`,b.goals.map(g=>g.outcome).join('; ')])
    ].sort((a,b)=>a[0]-b[0]).map(([time,stage,detail])=>[seconds(time),stage,String(detail).length>240?String(detail).slice(0,240)+'…':String(detail)])));
  if(c.checks?.failures?.length)lines.push('**Runtime failures:**',list(c.checks.failures));
  if(c.observerErrors?.length)lines.push('**Observation errors:**',list([...new Set(c.observerErrors)]));
  lines.push('### Samples, proposals and actual published content');
  if(calls.length)lines.push(...calls.map((q,i)=>renderCall(c,q,i,batches)));
  else{
    lines.push('Per-call inputs and responses were not captured in this older run.');
    for(const batch of batches)lines.push(`#### Published at ${seconds(batch.elapsedMs)}`,renderGoals(batch.goals));
  }
  lines.push('### Learning experience exercised',renderLessons(c),'### Evaluation outcome');
  if(judge){
    lines.push(table(['Dimension','Score (0–2)'],Object.entries(judge.scores??{})),
      '**Issues:**\n\n'+list(judge.issues),`**Suggested improvement:** ${inline(judge.improvement??'Not recorded')}`);
    if(judge.bestSample)lines.push('**Judge’s cited sample:**',fence(judge.bestSample));
  }else lines.push('No per-case quality judgment is available.');
  return lines.join('\n\n');
}
export function renderReport(report){
  const cases=report.cases??[];
  const lines=['# LearningHarness internal eval — evidence report',
    report.execution?.comparison?`Executor comparison: ${Object.entries(report.execution.arms).map(([arm,name])=>`${arm}: ${name}`).join('; ')}. Executor labels withheld from the quality judge.`:report.execution?.executor?`Executor: ${report.execution.executor}.`:'',
    `Run: ${inline(report.createdAt)}. Mode: **${inline(report.mode)}**. Overall: **${verdict(report.passed)}**.`,
    `Revision: \`${inline(report.revision??'Unknown')}\`${report.dirty?' (working changes)':''}.`,
    'Observed events are public work seen by the adapter. Each learning-call section shows the selected excerpts actually sent to the tutor, followed by what it proposed and what the runtime actually published. These are different measurements. Publication does not prove the user saw the panel.',
    table(['Case / attempt','First offer after observation','Learning calls','Published batches','Runtime','Quality'],cases.map(c=>[c.id,seconds(c.checks?.firstOfferMs),c.checks?.learningCalls??'Unknown',offerBatches(c).length,verdict(c.checks?.passed),verdict(report.judgment?.cases?.find(j=>j.id===c.id)?.passed)])),
    'The latency clock starts when the adapter observes the first task, not when the app starts. See each case’s timeline for observation and publication times. [Exact prompts, responses and complete observations](transcript.md).'
  ];
  if(report.execution?.comparison){
    const median=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null;};
    lines.push('## Executor comparison',table(['Executor','Cases','Runtime passes','Quality passes','Published-offer median','Reported input tokens','Reported output tokens','Unreported calls'],['custom','native'].map(name=>{
      const group=cases.filter(c=>c.executionMode===name);
      const unknown=group.reduce((n,c)=>n+(c.checks?.usage?.unreportedCalls??0),0);
      // Raw Codex totals are already inclusive. Older engine snapshots added
      // cached input again; do not carry that bookkeeping error into comparison.
      const tokens=key=>group.reduce((n,c)=>n+(c.learningRequests??[]).reduce((n,q)=>n+((q.usage??q.reportedUsage)?.[key]??0),0),0);
      return[name,group.length,group.filter(c=>c.checks?.passed).length,report.judgment?.calibrated?group.filter(c=>report.judgment.cases.find(j=>j.id===c.id)?.passed).length:'Untrusted/unavailable',seconds(median(group.map(c=>c.checks?.firstOfferMs))),(unknown?'at least ':'')+tokens('input'),(unknown?'at least ':'')+tokens('output'),unknown];
    })), 'Latency medians include only cases with a published offer; failures remain in pass counts. Token totals use raw inclusive Codex per-call totals rather than historical engine counters that double-counted cached input. Available partial snapshots for failed calls are included as lower bounds when any calls remain unreported. This small repeated sample does not establish educational efficacy or statistical superiority.');
  }
  if(report.scope)lines.push('## Gate scope',report.scope,report.fullLessons?`Complete content and adaptation gate: **${verdict(report.fullLessons.passed)}**. [Actual lessons, hypotheses, scores, failures and exact prompts](learning-value/report.md).`:'Complete lessons were not exercised in this diagnostic run.');
  if(report.fullLessons?.adaptive)lines.push(`Adaptive answer paths: **${verdict(report.fullLessons.adaptive.passed)}**. [Actual answers, feedback and different next lessons](learning-value/adaptive/report.md).`);
  if(report.fatalError)lines.push('## Run failed',fence(report.fatalError));
  lines.push(...cases.map(c=>renderCase(report,c)),'## Judge and token accounting',
    `Quality status: **${inline(report.qualityStatus??'Not run')}**. Calibration: **${report.judgment?report.judgment.calibrated?'PASS':'FAIL':'Not run'}**.`,
    table(['Role','Input tokens','Output tokens','Notes'],[
      ...cases.map(c=>['Coding worker: '+c.id,c.mainUsage?.inputTokens??'Unknown',c.mainUsage?.outputTokens??'Unknown','Native host accounting']),
      ...cases.map(c=>['Learning: '+c.id,c.checks?.usage?.input??'Unknown',c.checks?.usage?.output??'Unknown',c.checks?.usage?.unreportedCalls?`${c.checks.usage.unreportedCalls} unreported calls`:'See per-call measured/estimated labels']),
      ['Judge',report.judgeTrace?.usage?.input??'Unknown',report.judgeTrace?.usage?.output??'Unknown',report.judgeTrace?`${report.judgeTrace.model}; ${seconds(report.judgeTrace.durationMs)}`:'Not run']
    ]));
  if(report.judgeError)lines.push('Judge error: '+inline(report.judgeError));
  if(report.judgment?.examples)lines.push('### Calibration examples',table(['Example','Classification','Reason'],report.judgment.examples.map(e=>[e.id,e.classification,e.reason])));
  lines.push('## Scope and limitations',list(report.limitations),'Fixed scenario inputs do not make live runs deterministic. Coding-agent actions, selected excerpts, response timing and tutor outputs can all vary. Compare actual per-call prompts before attributing output differences to the tutor.');
  return lines.join('\n\n')+'\n';
}
export function renderTranscript(report){
  const lines=['# Exact eval transcript','Synthetic evaluation data only. Application prompts are recorded verbatim; host system instructions and private reasoning are not captured.'];
  for(const c of report.cases??[]){
    lines.push(`## ${inline(c.id)}`);
    for(const file of c.inputs?.files??[])lines.push(`### Starting file: ${inline(file.path)}`,fence(file.content));
    for(const [index,request]of(c.learningRequests??[]).entries())lines.push(`### Learning call ${index+1}: exact prompt`,fence(request.prompt),`### Learning call ${index+1}: exact response`,fence(request.response??request.error),`### Learning call ${index+1}: metadata`,fence(json({...request,prompt:undefined,response:undefined}),'json'));
    lines.push('### Complete observed public events',fence(json(c.observations??[]),'json'));
  }
  lines.push('## Judge: exact prompt',fence(report.judgeTrace?.prompt),'## Judge: exact response',fence(report.judgeTrace?.response??report.judgeError),'## Recorded runtime / policy hashes',fence(json(report.hashes),'json'));
  return lines.join('\n\n')+'\n';
}
export function renderComparison(entries){
  const groups=new Map();
  for(const entry of entries)for(const c of entry.report.cases??[]){const key=caseName(c);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...entry,c});}
  const lines=['# LearningHarness eval — repeated-run comparison','Each row is one observed attempt. Fixed inputs are checked separately from the actual model prompt; the coding agent can generate different work even when the scenario is identical. Matching inputs do not imply matching outputs.'];
  for(const [id,attempts]of groups){
    const base=attempts.find(entry=>entry.c.inputs?.files)??attempts[0];
    lines.push(`## ${inline(id)}`,`Reference: ${inline(base.report.createdAt)} / attempt ${base.c.attempt??1}${base.c.inputs?.files?' (complete fixed-input manifest)':' (task/profile/title only)'}.`,table(['Run / attempt','Fixed inputs vs reference','Actual first-call input vs reference','First offer','Calls','Published offers'],attempts.map((entry,index)=>{
      const q=entry.c.learningRequests?.[0],firstQ=base.c.learningRequests?.[0];
      const prompts=q?.prompt&&firstQ?.prompt?(hash(q.prompt)===hash(firstQ.prompt)?'same model inputs':'different model inputs'):'Not captured';
      return [`${entry.report.createdAt??'Unknown'} / ${entry.c.attempt??1}`,entry===base?'reference':fixedInputsMatch(base.c,entry.c),entry===base?'reference':prompts,seconds(entry.c.checks?.firstOfferMs),entry.c.checks?.learningCalls??'Unknown',offerBatches(entry.c).map((b,i)=>`batch ${i+1}: ${b.goals.map(g=>g.outcome).join('; ')}`).join(' / ')||'None'];
    })));
    const runtimeHashes=attempts.map(e=>e.report.hashes?.['packages/runtime/src/learning-engine.js']);
    if(runtimeHashes.every(Boolean))lines.push(`Recorded runtime hash: ${new Set(runtimeHashes).size===1?'unchanged':'changed; these runs also differ in implementation'}.`);
    const policyHashes=attempts.map(e=>e.report.hashes?.['packages/learning/src/tutoring-policy.js']);
    lines.push(policyHashes.every(Boolean)?`Tutor policy hash: ${new Set(policyHashes).size===1?'unchanged across these runs':'changed across these runs; output changes cannot be attributed to sampling variance alone'}.`:'Policy hash was not recorded for every run.');
    for(const entry of attempts){
      lines.push(`### ${inline(entry.report.createdAt)} — attempt ${entry.c.attempt??1}`,`Fixed task/profile/title fingerprint: \`${hash(coarseInputs(entry.c))}\`.`,
        ...offerBatches(entry.c).map((batch,index)=>`#### Batch ${index+1} at ${seconds(batch.elapsedMs-batch.observedTaskAt)} after task observation\n\n${renderGoals(batch.goals)}`));
      if(entry.path)lines.push(`Full evidence report: [${inline(entry.report.createdAt)}](${join(dirname(entry.path),'report.md')}).`);
    }
  }
  return lines.join('\n\n')+'\n';
}
export async function writeReportBundle(report,directory){
  await writeFile(join(directory,'report.md'),renderReport(report),{mode:0o600});
  await writeFile(join(directory,'transcript.md'),renderTranscript(report),{mode:0o600});
}
export async function readRecentReports(root,mode,exclude){
  const entries=await readdir(root,{withFileTypes:true});const reports=[];
  for(const entry of entries.filter(e=>e.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(e.name)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,30)){
    const path=join(root,entry.name,'report.json');if(resolve(path)===resolve(exclude))continue;
    try{const report=JSON.parse(await readFile(path,'utf8'));if(report.mode===mode&&Array.isArray(report.cases)&&report.cases.length)reports.push({report,path});}catch{}
    if(reports.length===3)break;
  }
  return reports.reverse();
}
