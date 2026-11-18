import {CanvasArtifact} from './CanvasArtifact.js';
import { VisualArtifact } from './VisualArtifact.js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { evaluateExperiment } from '../../experiences/src/experiment.js';
function NumericExperiment(props: { spec: any }) {
  const [values, setValues] = createSignal<Record<string, number>>({});
  const output = createMemo(() => { try { return evaluateExperiment(props.spec, values()); } catch { return [{ label: 'Experiment unavailable', value: 'This saved experiment is invalid.' }]; } });
  return <section class="dd-experiment" aria-label={props.spec.title}>
    <h3>{props.spec.title}</h3><p class="dd-muted">Illustrative model · change an input and watch the outcome.</p>
    <For each={props.spec.controls}>{(control: any) => <label class="dd-control">{control.label}<span>{values()[control.id] ?? control.value}</span><input type="range" min={control.min} max={control.max} step={control.step ?? 1} value={values()[control.id] ?? control.value} onInput={e => setValues(v => ({ ...v, [control.id]: Number(e.currentTarget.value) }))} /></label>}</For>
    <div class="dd-outcomes"><For each={output()}>{(item: any) => <div><span>{item.label}</span><output>{String(item.value)}</output></div>}</For></div>
    <details><summary>Experiments to try</summary><ul><For each={props.spec.experiments}>{(text: string) => <li>{text}</li>}</For></ul></details>
    <button class="dd-link" onClick={() => setValues({})}>Reset experiment</button>
  </section>;
}

export function Experiment(props: {spec:any;allowCanvas?:boolean}) { return <Show when={props.spec?.format === 'canvas'} fallback={<Show when={props.spec?.format === 'visual'} fallback={<NumericExperiment spec={props.spec} />}><VisualArtifact spec={props.spec} /></Show>}><Show when={props.allowCanvas} fallback={<p class="dd-muted">This interactive needs a canvas-capable learning surface.</p>}><CanvasArtifact spec={props.spec}/></Show></Show>; }
