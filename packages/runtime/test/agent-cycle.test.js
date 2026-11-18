import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentCycle } from '../src/agent-cycle.js';
const present = { tool: 'present', input: { experience: { decision: 'offer', objective: 'O' }, sourceIds: [] }, reason: 'A smaller example is appropriate' };
const options = () => ({ prompt: 'Choose', request: async () => JSON.stringify(present), validateExperience: x => x, work: [], learner: [], goal: { outcome: 'O' }, check: () => {} });
test('compact opportunity supplies bounded structured envelope without allowing extra tools',async()=>{
 let schema;
 const result=await runAgentCycle({...options(),intent:'goals',compact:true,validateGoals:x=>x,request:async(_,__,constraints)=>{schema=constraints;return JSON.stringify({tool:'stay_silent',input:{reason:'No relevant opportunity'},reason:'Thin evidence'});}});
 assert.equal(result.decision,'silent');
 assert.deepEqual(schema.properties.tool.enum,['suggest_goals','stay_silent']);
 const goal=schema.properties.input.anyOf[0].properties.goals.items;
 assert.equal(goal.properties.insight.maxLength,280);
 assert(goal.required.includes('insight'));
 assert.equal(goal.properties.skillId,undefined);
});
test('model retrieves evidence then presents; actual tool result returns to the model', async () => {
  const o = options(); const prompts = []; let n = 0;
  o.work = [{ id: 'e1', type: 'tool.succeeded', data: { output: 'actual source' } }];
  o.request = async prompt => { prompts.push(prompt); return JSON.stringify(n++ === 0 ? { tool: 'retrieve_work', input: { ids: ['e1'] }, reason: 'Inspect the result' } : { ...present, input: { ...present.input, sourceIds: ['e1'] } }); };
  const result = await runAgentCycle(o);
  assert.equal(result.experience.objective, 'O');
  assert.match(prompts[1], /actual source/);
  assert.deepEqual(result.trace.map(t => t.tool), ['retrieve_work', 'present']);
});
test('hands-on cannot accept a prediction or missing/failed interactive', async () => {
  for (const experience of [{ decision: 'offer', objective: 'O', kind: 'predict' }, { decision: 'offer', objective: 'O', kind: 'demonstrate' }]) {
    await assert.rejects(runAgentCycle({ ...options(), requireInteractive: true, request: async () => JSON.stringify({ ...present, input: { experience, sourceIds: [] } }) }), /budget|interactive/);
  }
});
test('unknown tools, extra fields, invented sources and unrelated goals never publish and exhaust bounded repair', async () => {
  for (const value of [{ tool: 'write_file', input: {}, reason: 'bad' }, { ...present, path: '/tmp' }, { ...present, input: { experience: { objective: 'Different' }, sourceIds: [] } }, { ...present, input: { ...present.input, sourceIds: ['invented'] } }]) {
    let count = 0;
    await assert.rejects(runAgentCycle({ ...options(), request: async () => { count++; return JSON.stringify(value); } }), /budget/);
    assert.equal(count, 4);
  }
});
test('stop between a retrieval and model dispatch prevents further requests', async () => {
  let stopped = false; let count = 0;
  await assert.rejects(runAgentCycle({ ...options(), check: () => { if (stopped) throw new Error('stopped'); }, request: async () => { count++; stopped = true; return JSON.stringify({ tool: 'retrieve_learner', input: {}, reason: 'Check previous attempts' }); } }), /stopped/);
  assert.equal(count, 1);
});

test('an explicitly requested interactive cannot terminate with a text-only answer', async()=>{
 await assert.rejects(runAgentCycle({...options(),intent:'ask',requireInteractive:true,maxRequests:1,request:async()=>JSON.stringify({tool:'answer_question',input:{answer:'Just text'},reason:'Skipped building'})}),/budget/);
});
