import { createMemo, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { validateVisualArtifact, visualFrame } from '../../experiences/src/visual-artifact.js';
export function VisualArtifact(props: { spec: any }) {
  const safe = createMemo(() => { try { return validateVisualArtifact(props.spec); } catch { return null; } });
  const [scenario, setScenario] = createSignal(0); const [step, setStep] = createSignal(0); const [playing, setPlaying] = createSignal(false);
  const selected = () => safe()?.scenarios[scenario()]; const current = () => selected()?.steps[step()];
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = createMemo(() => safe() && visualFrame(safe(), scenario(), step(), playing() && !reduced));
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => { if(timer) clearTimeout(timer); const index=step();const length=selected()?.steps.length??0; if(playing())timer=setTimeout(()=>{if(index+1<length)setStep(index+1);else setPlaying(false)},3200); });
  onCleanup(() => { if(timer) clearTimeout(timer); });
  const reset = (index=scenario()) => { setPlaying(false);setScenario(index);setStep(0); };
  const advance = (delta:number) => { setPlaying(false);setStep(v=>Math.max(0,Math.min((selected()?.steps.length??1)-1,v+delta))); };
  return <Show when={safe()} fallback={<p class="dd-muted">This saved visual could not be loaded. Ask to create it again.</p>}><section class="dd-visual" aria-label={safe()!.title}>
    <div class="dd-visual-heading"><h3>{safe()!.title}</h3><span>Explore</span></div>
    <Show when={safe()!.scenarios.length>1}><label class="dd-visual-scenario">Scenario<select aria-label="Simulation scenario" value={scenario()} onChange={e=>reset(Number(e.currentTarget.value))}><For each={safe()!.scenarios}>{(item:any,index)=><option value={index()}>{item.label}</option>}</For></select></label></Show>
    <div class="dd-visual-stage" style={{'aspect-ratio':safe()!.viewBox.split(/[ ,]+/).slice(2).join(' / ')}}><iframe sandbox="" referrerpolicy="no-referrer" title={`${safe()!.title} — ${current()?.title}`} srcdoc={frame() as string} /></div>
    <div class="dd-visual-step" aria-live={playing()?'off':'polite'}><span class="dd-visual-position">{step()+1} / {selected()!.steps.length}</span><div><h4>{current()?.title}</h4><p>{current()?.body}</p></div></div>
    <Show when={current()?.state?.length}><dl class="dd-visual-state" aria-label="Current values"><For each={current()!.state}>{(cell:any)=><div><dt>{cell.label}</dt><dd>{cell.value}</dd></div>}</For></dl></Show>
    <div class="dd-visual-progress" aria-hidden="true"><For each={selected()!.steps}>{(_,index)=><span classList={{done:index()<=step()}} />}</For></div>
    <div class="dd-visual-controls"><button class="dd-secondary" aria-label={playing()?'Pause simulation':'Play simulation'} onClick={()=>{if(!playing()&&step()===selected()!.steps.length-1)setStep(0);setPlaying(v=>!v)}}>{playing()?'Ⅱ Pause':'▶ Play'}</button><div><button class="dd-link" aria-label="Previous simulation step" disabled={step()===0} onClick={()=>advance(-1)}>← Back</button><button class="dd-link" aria-label="Next simulation step" disabled={step()===selected()!.steps.length-1} onClick={()=>advance(1)}>Next →</button><button class="dd-link" aria-label="Restart simulation" title="Restart" onClick={()=>reset()}>↺</button></div></div>
  </section></Show>;
}
