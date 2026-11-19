import {For,Show} from 'solid-js';
import {MindMap} from './MindMap.js';
import {Experiment} from './Experiment.js';

// A read-only account of earlier work. Starting another attempt remains an
// explicit action in Journey, so rereading never creates assessment evidence.
export function SessionStack(props:{history:any[];sessionID?:string}) {
 const items=()=>props.sessionID?props.history.filter(item=>item.sessionID===props.sessionID):[];
 return <Show when={items().length}>
  <section class="lh-session-stack"><h2>Earlier in this session</h2>
   <For each={items()}>{item=>
    <details><summary>{item.title||item.objective}</summary>
     <Show when={item.lesson?.sections?.length} fallback={<p>{item.body}</p>}>
      <For each={item.lesson?.sections??[]}>{(section:any)=>
       <div><h3>{section.title}</h3><p>{section.body}</p></div>
      }</For>
     </Show>
     <Show when={item.mindMap}><MindMap spec={item.mindMap}/></Show>
     <Show when={item.experiment}><Experiment allowCanvas={false} spec={item.experiment}/></Show>
     <Show when={item.question}><p><b>{item.question}</b></p></Show>
     <Show when={item.feedback} fallback={
      <Show when={item.draft?.answer||item.draft?.choice}>
       <blockquote>Your saved answer: {item.draft.answer||item.draft.choice}</blockquote>
      </Show>
     }><blockquote>Your answer: {item.feedback?.answer}<p>{item.feedback?.feedback}</p></blockquote></Show>
    </details>
   }</For>
  </section>
 </Show>;
}
