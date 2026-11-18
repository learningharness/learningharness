import {createEffect,createSignal,Show} from 'solid-js';
export function RecallCard(props:{moment:any;feedback:any;draft:string;disabled:boolean;onDraft:(text:string)=>void;onSubmit:()=>void;onReveal:()=>void}){
 const [back,setBack]=createSignal(false);let currentId='',answerAvailable=false;
 createEffect(()=>{const m=props.moment,available=Boolean(m.answer);if(m.id!==currentId){currentId=m.id;answerAvailable=available;setBack(available);}else if(available&&!answerAvailable){answerAvailable=true;setBack(true);}});
 const flip=()=>{if(props.moment.answer)setBack(true);else props.onReveal();};
 return <section class="lh-recall-card" aria-label="Recall flashcard" aria-busy={props.disabled}>
  <Show when={back()} fallback={<div class="lh-card-side" aria-label="Flashcard question">
   <span class="lh-card-label">QUESTION · 1 OF 2</span><h2>{props.moment.question}</h2>
   <Show when={!props.feedback}><label class="lh-card-prompt">Recall it in your own words<textarea aria-label="Your recall" class="dd-input" value={props.draft} onInput={e=>props.onDraft(e.currentTarget.value)} placeholder="What’s the mechanism?" disabled={props.disabled}/></label></Show>
   <div class="lh-card-actions"><Show when={!props.feedback}><button class="dd-primary" disabled={props.disabled||!props.draft.trim()} onClick={props.onSubmit}>Check my recall</button></Show><button class="dd-link" disabled={props.disabled} onClick={flip}>Flip to answer ↗</button></div>
   <Show when={!props.feedback}><p class="lh-card-note">{props.moment.answerRevealed?'You’ve seen the answer. This attempt counts as practice with help.':'Try recalling first. Flipping to the answer counts as help.'}</p></Show>
  </div>}><div class="lh-card-side lh-card-answer" role="region" aria-label="Flashcard answer" aria-live="polite">
   <span class="lh-card-label">ANSWER · 2 OF 2</span><h2>The mechanism</h2><p>{props.moment.answer}</p>
   <button class="dd-secondary" disabled={props.disabled} onClick={()=>setBack(false)}>← Flip to question</button>
   <Show when={!props.feedback}><p class="lh-card-note">Answer revealed. Flip back to practise it in your own words; the help stays recorded.</p></Show>
  </div></Show>
 </section>;
}
