import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExperiment, evaluateExperiment } from '../src/experiment.js';
const spec = { title: 'Retry budget', controls: [{ id: 'limit', label: 'Attempts', min: 1, max: 5, value: 1 }], outputs: [{ label: 'Requests', expression: { op: 'multiply', args: ['limit', 2] } }], experiments: ['Predict the boundary'] };
test('shipped interpreter computes changed inputs and rejects arbitrary code, extra keys and invalid expressions', () => {
  assert.equal(evaluateExperiment(spec)[0].value, 2);
  assert.equal(evaluateExperiment(spec, { limit: 5 })[0].value, 10);
  for (const malicious of [{ ...spec, script: 'fetch(...)' }, { ...spec, outputs: [{ label: 'Bad', expression: { op: 'eval', args: ['limit'] } }] }, { ...spec, outputs: [{ label: 'Bad', expression: { op: 'multiply', args: ['unknown', 2] } }] }]) assert.throws(() => validateExperiment(malicious));
  assert.throws(() => evaluateExperiment(spec, { limit: 6 }), /bounds/);
});
