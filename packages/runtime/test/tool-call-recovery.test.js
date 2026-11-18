import {decodeToolCall} from '../src/tool-call.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentCycle } from '../src/agent-cycle.js';
import { parseGoals } from '../src/learning-engine.js';
const goal = { kind: 'core', outcome: 'Explain a retry boundary', whyNow: 'The retry helper classifies transient failures', minutes: 2 };
const call = goals => JSON.stringify({ tool: 'suggest_goals', input: { goals }, reason: 'Useful in the current work' });
test('a truncated response can retain a complete validated goal, never invent its missing text', async () => {
  let calls = 0;
  const text = '{"tool":"suggest_goals","input":{"goals":[' + JSON.stringify(goal) + ',{"kind":"stretch","outcome":"unfinished';
  const result = await runAgentCycle({ intent: 'goals', prompt: 'Pick one', validateGoals: value => parseGoals(JSON.stringify(value)), request: async () => { calls++; return text; } });
  assert.equal(calls, 1); assert.deepEqual(result.goals.map(g => g.outcome), [goal.outcome]);
});
test('valid goals survive a malformed sibling without repairing presentation constraints through another model call', async () => {
  let calls = 0;
  const result = await runAgentCycle({ intent: 'goals', prompt: 'Pick one', validateGoals: value => parseGoals(JSON.stringify(value)), request: async () => { calls++; return call([goal, { ...goal, outcome: 'x'.repeat(81) }]); } });
  assert.equal(calls, 1); assert.equal(result.goals.length, 1);
});
test('recovery cannot invent a first goal, recover executable tools, or accept invalid recovered content', async () => {
  for (const text of ['{"tool":"suggest_goals","input":{"goals":[{"outcome":"unfinished', '{"tool":"write_file","input":{"goals":[' + JSON.stringify(goal), '{"tool":"suggest_goals","input":{"goals":[' + JSON.stringify({ ...goal, minutes: 0 }) + ',{']) {
    await assert.rejects(runAgentCycle({ intent: 'goals', prompt: 'Pick one', maxRequests: 1, validateGoals: value => parseGoals(JSON.stringify(value)), request: async () => text }), /budget/);
  }
});

test('blank non-content trace labels do not discard complete goal proposals',()=>{
 const input={goals:[{kind:'orient',outcome:'Map cache ownership',whyNow:'The task changes the request/store boundary.',minutes:5,insight:'A cache is derived state. Writes must invalidate or refresh it.'}]};
 const decoded=decodeToolCall(JSON.stringify({tool:'suggest_goals',input,reason:'  '}));
 assert.equal(decoded.recovered,true);assert.deepEqual(decoded.choice.input,input);assert.equal(decoded.choice.reason,'Publish validated learning opportunities');
 const executable=decodeToolCall(JSON.stringify({tool:'build_interactive',input:{},reason:''}));assert.equal(executable.recovered,false);assert.equal(executable.choice.reason,'');
});
