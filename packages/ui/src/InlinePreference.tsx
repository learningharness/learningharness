import {createUniqueId,Show} from 'solid-js';

export function InlinePreference(props:{value:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
 const id=createUniqueId();
 return <section class="lh-inline-preference">
  <label class="lh-inline-opt-in" for={id}>
   <input id={id} type="checkbox" checked={props.value} disabled={props.disabled}
    onChange={event=>props.onChange(event.currentTarget.checked)}/>
   <span><strong>Allow quick questions inline</strong>
    <small>Answer a quiz or prediction in the chat. Full lessons and tools open in the sidebar.</small>
   </span>
  </label>
  <figure class="lh-placement-preview" classList={{sidebar:!props.value}}>
   <div class="lh-preview-window" aria-hidden="true">
    <div class="lh-preview-chat"><small>CODING CHAT</small><i/><i/>
     <Show when={props.value}>
      <div class="lh-preview-lesson"><small>QUICK PREDICTION</small>
       <b>What happens on the next retry?</b><span>◯ A new request starts</span><span>◯ The same error returns</span>
       <em>Check answer · Open in sidebar ↗</em>
      </div>
     </Show><i/>
    </div>
    <Show when={!props.value}>
     <div class="lh-preview-lesson"><small>LEARNINGHARNESS SIDEBAR</small><b>Your learning session</b><span>Lessons · Practice · Tools</span><hr/><span>Earlier in this session</span></div>
    </Show>
   </div>
   <figcaption>{props.value?'Just one short question, right beside the work. Open the sidebar for more.':'Learning invitations open in the sidebar.'}</figcaption>
  </figure>
  <p class="lh-placement-note">The sidebar always keeps your session together, including inline answers. Change this in Settings anytime.</p>
 </section>;
}
