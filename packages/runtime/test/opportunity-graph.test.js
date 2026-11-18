import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
import {createLearningTools,opportunityResponseSchema} from '../src/learning-tools.js';

const graphDelta={topics:[{ref:'expiry',conceptId:'',label:'Cache expiry',definition:'Entry eligibility ends at a configured deadline.',sourceIds:['task']}],relationships:[]};
test('generated opportunity schemas require all declared fields for the strict host gateway',()=>{
 const schema=opportunityResponseSchema(createLearningTools({intent:'goals'}));
 const visit=s=>{if(s.type==='object')assert.deepEqual([...(s.required??[])].sort(),Object.keys(s.properties??{}).sort());for(const child of Object.values(s.properties??{}))visit(child);if(s.items)visit(s.items);for(const child of s.anyOf??[])visit(child);};
 visit(schema);
});
async function fixture(input,tool='stay_silent'){
 let saved,calls=0,prompt='';
 const storage={get:async()=>saved,set:async(_,value)=>{saved=structuredClone(value);}};
 const gateway={generate:async request=>{calls++;prompt=request.prompt;return {text:JSON.stringify({tool,input,reason:'Evaluate the selected work'}),usage:{input:10,output:10}};}};
 const options={storage,gateway,defaultLearningModel:{providerID:'fixture',modelID:'fixture'},maxGoalRequests:1,debounceMs:60000,capabilities:{host:'fixture',observation:{kinds:['task.submitted']},model:{independent:true},surface:{experiments:false}}};
 const engine=new LearningEngine(options);await engine.load();await engine.command({action:'enable'});
 await engine.onWorkEvent({id:'task',sessionId:'chat',type:'task.submitted',data:{text:'Implement cache expiry'}});
 return {engine,options,get calls(){return calls;},get prompt(){return prompt;},cleanup(){for(const t of engine.parallelTimers.values())clearTimeout(t);}};
}
test('a silent opportunity persists topic assignments in the same call without assessed knowledge',async()=>{
 const h=await fixture({reason:'Already explained; no lesson needed',graphDelta});
 try{
  assert.equal(await h.engine.generateGoals('chat'),null);
  assert.equal(h.calls,1);assert.equal(h.engine.state.workGraph.concepts.length,1);
  assert.equal(h.engine.state.workGraph.encounters[0].sources[0].basis,'task_intent');
  assert.equal(h.engine.session('chat').evidence.length,0);assert.deepEqual(h.engine.state.memory.topics,{});
  const restored=new LearningEngine(h.options);await restored.load();
  assert.deepEqual(restored.state.workGraph,h.engine.state.workGraph);assert.equal(h.calls,1);
  assert.match(h.prompt,/graphDelta/);
 }finally{h.cleanup();}
});
test('malformed graph output cannot spend a repair call or discard a valid opportunity',async()=>{
 const goal={kind:'core',outcome:'Reason about cache expiry',whyNow:'A deadline changes eligibility.',minutes:2};
 for(const bad of ['invalid',{topics:[{...graphDelta.topics[0],sourceIds:['not_in_packet']}],relationships:[]}]){
  const h=await fixture({goals:[goal],graphDelta:bad},'suggest_goals');
  try{const result=await h.engine.generateGoals('chat');assert.equal(result.list[0].outcome,goal.outcome);assert.equal(h.calls,1);assert.equal(h.engine.state.workGraph.concepts.length,0);assert.equal(h.engine.session('chat').graphUpdate.status,'rejected');}finally{h.cleanup();}
 }
});
test('legacy opportunities without graph data remain compatible',async()=>{
 const h=await fixture({reason:'Nothing useful to add'});
 try{await h.engine.generateGoals('chat');assert.equal(h.calls,1);assert.equal(h.engine.state.workGraph.concepts.length,0);}finally{h.cleanup();}
});
test('Off and a changed project scope discard graph writes from an in-flight response',async()=>{
 for(const change of ['off','scope']){
  const h=await fixture({reason:'No invitation',graphDelta});let release,started;
  const waiting=new Promise(resolve=>{started=resolve;});
  h.engine.gateway.generate=async()=>{started();await new Promise(resolve=>{release=resolve;});return {text:JSON.stringify({tool:'stay_silent',input:{reason:'No invitation',graphDelta},reason:'Observe work'}),usage:{input:10,output:10}};};
  try{
   const pending=h.engine.generateGoals('chat');await waiting;
   if(change==='off')await h.engine.command({action:'disable'});else h.engine.session('chat').context={projectKey:'project_new'};
   release();await pending;
   assert.equal(h.engine.state.workGraph.concepts.length,0);
  }finally{h.cleanup();}
 }
});
test('a reference to selected but unsent work cannot support a topic',async()=>{
 const h=await fixture({reason:'No invitation',graphDelta:{...graphDelta,topics:[{...graphDelta.topics[0],sourceIds:['unsent']}]}});
 try{
  // The tool-loop trace has more data than the compact opportunity packet.
  h.engine.workSelection(h.engine.session('chat')).entries.push({sequence:2,priority:90,source:{id:'unsent',type:'file.changed',data:{content:'x'.repeat(5000)}}});
  await h.engine.generateGoals('chat');assert.equal(h.engine.state.workGraph.concepts.length,0);assert.equal(h.calls,1);
 }finally{h.cleanup();}
});
