import {createUniqueId,For,Show} from 'solid-js';

type Placement = 'inline' | 'sidebar';

function QuestionPreview() {
 return <>
  <small>LEARNINGHARNESS</small>
  <b>What happens on the next retry?</b>
  <span>◯ Predict it</span><span>◯ Trace it</span>
 </>;
}

export function PresentationChoice(props:{
 value:Placement;
 onChange:(value:Placement)=>void;
 disabled?:boolean;
}) {
 const id=createUniqueId();
 return <fieldset class="lh-presentation-choice" disabled={props.disabled}>
  <legend>Where would you like to learn?</legend>
  <div class="lh-presentation-options">
   <For each={['inline','sidebar'] as const}>{mode=>
    <label for={`${id}-${mode}`} classList={{selected:props.value===mode}}>
     <input id={`${id}-${mode}`} type="radio" name={`${id}-presentation`} value={mode}
      checked={props.value===mode} onChange={()=>props.onChange(mode)}/>
     <span><strong>{mode==='inline'?'Inline':'Sidebar'}</strong>
      <small>{mode==='inline'?'Right here in the chat':'Beside your coding chat'}</small>
     </span>
    </label>
   }</For>
  </div>
  <figure class="lh-placement-preview" classList={{sidebar:props.value==='sidebar'}}>
   <div class="lh-preview-window" aria-hidden="true">
    <div class="lh-preview-chat">
     <small>CODING CHAT</small><i/><i/>
     <div class="lh-preview-code"><i/><i/></div>
     <Show when={props.value==='inline'}>
      <div class="lh-preview-lesson"><QuestionPreview/><em>Open in sidebar ↗</em></div>
     </Show><i/>
    </div>
    <Show when={props.value==='sidebar'}>
     <div class="lh-preview-lesson"><QuestionPreview/><hr/>
      <small>EARLIER IN THIS SESSION</small><span>Why the timer needs to stop</span>
     </div>
    </Show>
   </div>
   <figcaption>{props.value==='inline'
    ?'Open an invitation to answer in place. Expand to the sidebar whenever you want more room.'
    :'Open invitations in the sidebar while your coding chat stays in view.'}</figcaption>
  </figure>
  <p class="lh-placement-note">Everything stays together in your session, including answers. Change this in Settings anytime.</p>
 </fieldset>;
}
