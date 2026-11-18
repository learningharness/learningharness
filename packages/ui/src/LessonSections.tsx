import {For,Show} from 'solid-js';
import {lessonCodeFocus} from '../../experiences/src/complete-lesson.js';

export function LessonSections(props:{lesson:any,sources?:any[]}){
 return <div class="lh-lesson"><For each={props.lesson.sections}>{(section:any)=>{
  const focus=()=>lessonCodeFocus(section,props.sources??[]);
  return <section><h2>{section.title}</h2>
   <Show keyed when={focus()}>{view=><figure class="lh-lesson-code-focus"><figcaption>{view.source.path||'Captured work'}<small>{view.source.status==='Captured host output · excerpt'?'Captured excerpt':view.source.status}</small></figcaption><pre><code>{view.quote}</code></pre></figure>}</Show>
   <p>{section.body}</p>
   <Show when={section.code&&!focus()}><small class="dd-muted">The saved code excerpt is unavailable. See the captured source below.</small></Show>
   <For each={section.sourceIds??[]}>{(id:string)=><Show keyed when={props.sources?.find(source=>source.id===id)} fallback={<small>Captured source excerpt unavailable.</small>}>{source=><details class="lh-lesson-citation"><summary>{source.path||'Captured work'} · view captured source</summary><small>{source.status}{source.truncated?' · Partial excerpt':''}{source.at?` · ${new Date(source.at).toLocaleString()}`:' · Capture time unavailable'}</small><pre><code>{source.text}</code></pre></details>}</Show>}</For>
  </section>;
 }}</For></div>;
}
