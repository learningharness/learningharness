import {validateCanvasArtifact} from './canvas-artifact.js';
import {compileFlowArtifact,flowArtifactInstructions} from './flow-artifact.js';
import { validateVisualArtifact, visualArtifactPrompt } from './visual-artifact.js';
import { exactObject, nonEmptyString } from '../../protocol/src/validation.js';
const arities = { add: 2, subtract: 2, multiply: 2, divide: 2, min: 2, max: 2, greater: 2, equal: 2, and: 2, or: 2, not: 1, if: 3 };
export function validateExperiment(spec) {
  if (spec?.format === 'canvas') return validateCanvasArtifact(spec);
  if (spec?.format === 'flow') return compileFlowArtifact(spec);
  if (spec?.format === 'visual') return validateVisualArtifact(spec);
  exactObject(spec, ['title', 'controls', 'outputs', 'experiments']);
  nonEmptyString(spec.title, '$.title', 120);
  if (JSON.stringify(spec).length > 12000) throw new Error('Experiment exceeds bounds');
  for (const key of ['controls', 'outputs', 'experiments']) if (!Array.isArray(spec[key]) || !spec[key].length || spec[key].length > 6) throw new Error('Experiment needs 1–6 controls, outputs and experiments');
  const ids = new Set();
  for (const c of spec.controls) {
    exactObject(c, ['id', 'label', 'min', 'max', 'value', 'step'], ['id', 'label', 'min', 'max', 'value']);
    nonEmptyString(c.label, '$.control.label', 120);
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(c.id) || ids.has(c.id) || ![c.min, c.max, c.value, c.step ?? 1].every(Number.isFinite) || c.min >= c.max || c.min < -1e6 || c.max > 1e6 || c.value < c.min || c.value > c.max || (c.step ?? 1) <= 0) throw new Error('Invalid experiment control');
    ids.add(c.id);
  }
  let nodes = 0;
  const expr = (n, depth = 0) => {
    if (++nodes > 200 || depth > 8) throw new Error('Expression exceeds bounds');
    if (typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e9 || typeof n === 'boolean') return;
    if (typeof n === 'string' && ids.has(n)) return;
    exactObject(n, ['op', 'args']);
    if (!Object.hasOwn(arities, n.op) || !Array.isArray(n.args) || n.args.length !== arities[n.op]) throw new Error('Invalid expression operator or arity');
    n.args.forEach(a => expr(a, depth + 1));
  };
  for (const o of spec.outputs) { exactObject(o, ['label', 'expression']); nonEmptyString(o.label, '$.output.label', 120); expr(o.expression); }
  spec.experiments.forEach(e => nonEmptyString(e, '$.experiment', 300));
  return structuredClone(spec);
}
export function evaluateExperiment(spec, values = {}) {
  const safe = validateExperiment(spec);
  const inputs = Object.fromEntries(safe.controls.map(c => { const n = values[c.id] ?? c.value; if (!Number.isFinite(n) || n < c.min || n > c.max) throw new Error('Control outside bounds'); return [c.id, n]; }));
  const ev = n => {
    if (typeof n === 'string') return inputs[n];
    if (typeof n !== 'object') return n;
    const a = n.args.map(ev);
    switch (n.op) {
      case 'add': return Number(a[0]) + Number(a[1]); case 'subtract': return Number(a[0]) - Number(a[1]);
      case 'multiply': return Number(a[0]) * Number(a[1]); case 'divide': return a[1] === 0 ? null : Number(a[0]) / Number(a[1]);
      case 'min': return Math.min(...a); case 'max': return Math.max(...a); case 'greater': return a[0] > a[1]; case 'equal': return a[0] === a[1];
      case 'and': return Boolean(a[0] && a[1]); case 'or': return Boolean(a[0] || a[1]); case 'not': return !a[0]; case 'if': return a[0] ? a[1] : a[2];
    }
  };
  return safe.outputs.map(o => { const value = ev(o.expression); return { label: o.label, value: value === null || typeof value === 'number' && !Number.isFinite(value) ? 'undefined' : value }; });
}
export function experimentPrompt(brief, goal) {
  return flowArtifactInstructions+'\nFor physical/spatial mechanisms that need custom geometry, use the following alternative. Do not use it for message flows or retry timelines.\n'+visualArtifactPrompt(brief, goal);
}
