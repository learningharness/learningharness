import {resolveGlobalJourneyRoute} from '../../experiences/src/global-journey-navigation.js';
import {createEffect,createSignal,For,Show} from 'solid-js';
import {SavedLearning} from './SavedLearning.js';
import {LessonSections} from './LessonSections.js';
import {Contrast} from './Contrast.js';
import {MindMap} from './MindMap.js';
import {Experiment} from './Experiment.js';
import {LearningLogo} from './LearningLogo.js';
import './global-learning-journey.css';

// This surface receives saved public teaching only. It has no command port and
// never borrows a coding-chat identity to read, practice, or generate teaching.
export function GlobalLearningJourney(props:{state:any,onSettings:()=>void,navigation?:{route:any},onNavigationApplied?:()=>void}){
 const [selected,setSelected]=createSignal<any>(null),[unavailable,setUnavailable]=createSignal(false);
 const library=()=>{setUnavailable(false);setSelected(null);};
 let appliedNavigation:any;
 createEffect(()=>{
  const navigation=props.navigation;
  if(!navigation||navigation===appliedNavigation||!props.state)return;
  appliedNavigation=navigation;
  const resolved=resolveGlobalJourneyRoute(props.state,navigation.route);
  setUnavailable(resolved.kind==='unavailable');setSelected(resolved.kind==='lesson'?resolved.record:null);
  props.onNavigationApplied?.();
 });
 const open=(id:string)=>{const record=props.state?.history?.find((item:any)=>item.id===id);if(record){setUnavailable(false);setSelected(structuredClone(record));}};
 return <main class="dd-root dd-panel lh-global-journey" aria-label="Learning journey across coding chats">
  <header class="dd-header"><div class="dd-header-title"><span class="dd-brand"><LearningLogo/><span>LearningHarness</span></span></div><button class="dd-link" onClick={props.onSettings}>Settings</button></header>
  <Show when={!unavailable()} fallback={<section class="lh-global-reading"><h1>Saved lesson unavailable</h1><p>This link does not match saved learning available here. The original record may no longer be saved.</p><button class="dd-link" onClick={library}>← Saved learning</button></section>}><Show when={selected()} fallback={<SavedLearning history={props.state?.history??[]} journeys={[]} reviews={props.state?.learner?.reviews??[]} now={props.state?.learner?.now??new Date().toISOString()} disabled={false} readOnlyGlobal onOpen={open} onJourney={()=>{}} onReview={()=>{}}/>}>
   <div class="lh-global-reading" tabindex="0">
    <button class="dd-link" onClick={library}>← Saved learning</button>
    <span class="dd-kicker">{selected()?.recordKind==='lesson'||selected()?.lesson?'Saved lesson':'Saved learning note'}</span>
    <h1>{selected()?.title}</h1>
    <Show when={selected()?.learningContext?.title||selected()?.learningContext?.project}><p class="dd-muted">From {selected()?.learningContext?.title||selected()?.learningContext?.project}</p></Show>
    <p>{selected()?.body}</p>
    <Show when={selected()?.entryMode==='prediction'&&!selected()?.explanationRevealed&&!selected()?.completed}><p class="dd-muted">This saved prediction has an unrevealed explanation. Open Learn in a coding chat to continue it.</p></Show>
    <Show when={selected()?.visual?.items?.length}><ol class="dd-steps"><For each={selected().visual.items}>{(item:string)=><li>{item}</li>}</For></ol></Show>
    <Show when={selected()?.lesson}><LessonSections lesson={selected().lesson} sources={selected().sources??[]}/><Show when={selected()?.lesson?.takeaway}><aside class="lh-takeaway"><b>Takeaway</b><p>{selected().lesson.takeaway}</p></aside></Show></Show>
    <Show when={selected()?.comparison}><Contrast value={selected().comparison}/></Show>
    <Show keyed when={selected()?.mindMap}>{spec=><MindMap spec={spec}/>}</Show>
    <Show keyed when={selected()?.experiment}>{spec=><Experiment spec={spec} allowCanvas={props.state?.capabilities?.surface?.canvasArtifacts===true}/>}</Show>
    <Show when={selected()?.deck}><section class="dd-status" aria-label="Saved flashcard deck"><h2>Saved flashcard deck</h2><p>Open Learn in a coding chat to resume this deck. Unrevealed answers are not included in this saved view.</p></section></Show>
    <Show when={selected()?.question}><section><h2>Original practice prompt</h2><p>{selected().question}</p><Show when={selected()?.answerRevealed&&selected()?.answer}><p>{selected().answer}</p></Show></section></Show>
    <Show when={selected()?.feedback}><section><h2>Your earlier attempt</h2><p>{selected().feedback.answer}</p><p>{selected().feedback.feedback}</p></section></Show>
    <Show when={selected()?.hint}><p><b>Hint used:</b> {selected().hint.text}</p></Show>
    <Show when={selected()?.help}><section><h2>Your follow-up</h2><p>{selected().help.question}</p><p>{selected().help.answer}</p><Show keyed when={selected().help.mindMap}>{spec=><MindMap spec={spec}/>}</Show><Show keyed when={selected().help.experiment}>{spec=><Experiment spec={spec} allowCanvas={props.state?.capabilities?.surface?.canvasArtifacts===true}/>}</Show></section></Show>
    <details class="lh-saved-evidence"><summary>Saved source evidence</summary><p class="dd-muted">Captured during the original work; code may have changed since.</p><Show when={selected()?.sources?.length} fallback={<p>No source excerpt was saved with this entry.</p>}><For each={selected()?.sources??[]}>{(source:any)=><section class="dd-sources"><h3>{source.path||'Saved work context'}</h3><small>{source.status}{source.at?` · ${source.at}`:''}</small><pre><code>{source.text}</code></pre><Show when={source.truncated}><small>Excerpt truncated.</small></Show></section>}</For></Show></details>
    <p class="lh-global-review-note">Open Learn in a coding chat to practice, ask a question, or prepare a review. Reading saved learning here uses no model calls.</p>
   </div>
  </Show></Show>
 </main>;
}
