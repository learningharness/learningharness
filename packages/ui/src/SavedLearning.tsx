import {createEffect,createSignal,For,Show} from 'solid-js';
import {WorkJourney} from './WorkJourney.js';
import {JourneyReviews} from './JourneyReviews.js';

export function SavedLearning(props:{history:any[],journeys:any[],reviews:any[],now:string,disabled:boolean,onOpen:(id:string)=>void,onJourney:(journey:any,index:number)=>void,onReview:(key:string)=>void,readOnlyGlobal?:boolean}){
 let scroll:HTMLDivElement|undefined;
 const [page,setPage]=createSignal(0);
 const changePage=(next:number)=>{setPage(next);scroll?.scrollTo({top:0});};
 const pages=()=>Math.max(1,Math.ceil(props.history.length/5));
 createEffect(()=>{if(page()>=pages())changePage(pages()-1);});
 const preview=(item:any)=>String(item.lesson?.takeaway||item.body||item.question||'').slice(0,210);
 const date=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Saved earlier':parsed.toLocaleDateString();};
 return <section class="lh-library" aria-label="Your learning journey">
  <div class="lh-library-scroll" ref={scroll}>
   <span class="dd-kicker">Your learning journey</span><h1>Keep building understanding</h1>
   <For each={props.journeys}>{journey=><WorkJourney journey={journey} disabled={props.disabled} onOpen={index=>props.onJourney(journey,index)}/>}</For>
   <Show when={!props.readOnlyGlobal} fallback={<section aria-label="Learning across coding chats"><h2>Keep learning from your work</h2><p class="dd-muted">Open saved teaching here, including when learning is off. To practice or review an idea, open Learn in a coding chat.</p></section>}><JourneyReviews reviews={props.reviews} now={props.now} disabled={props.disabled} onReview={props.onReview}/></Show>
   <div class="lh-library-heading"><h2>Saved learning</h2><p class="dd-muted">Return to teaching saved from your coding work. Saved source excerpts are available where captured.</p></div>
   <Show when={props.disabled}><p class="dd-status">Turn learning on to reopen saved learning.</p></Show>
   <Show when={props.history.length} fallback={<p>Saved lessons and learning notes will appear here. Coding chats without saved teaching are not listed.</p>}>
    <div class="lh-saved-list"><For each={props.history.slice(page()*5,page()*5+5)}>{item=><article class="lh-saved-card">
     <div class="lh-saved-meta"><span>{item.recordKind==='lesson'||item.lesson?'Lesson':'Learning note'}</span><time dateTime={item.createdAt}>{date(item.createdAt)}</time></div>
     <h3><button class="lh-saved-title" disabled={props.disabled} onClick={()=>props.onOpen(item.id)}>{item.title}<span aria-hidden="true"> ↗</span></button></h3>
     <Show when={item.learningContext?.title||item.learningContext?.project}><p class="lh-saved-origin">{item.learningContext?.title||item.learningContext?.project}</p></Show>
     <p class="lh-saved-preview">{preview(item)}{preview(item).length===210?'…':''}</p>
     <Show when={item.recordKind!=='lesson'&&!item.lesson}><small class="dd-muted">Saved teaching from your earlier work.</small></Show>
     <button class="dd-secondary lh-open-saved" disabled={props.disabled} onClick={()=>props.onOpen(item.id)}>{item.recordKind==='lesson'||item.lesson?'Open saved lesson':'Open learning note'} <span aria-hidden="true">→</span></button>
     <details class="lh-saved-evidence"><summary>Previous answers and source evidence</summary><p class="dd-muted">Saved at the time of this learning; code may have changed since.</p>
      <Show when={item.draft?.answer||item.draft?.choice}><p><b>Unsubmitted draft:</b> {item.draft.answer||item.draft.choice}</p></Show>
      <Show when={item.feedback}><p><b>Your answer:</b> {item.feedback.answer}</p><p>{item.feedback.feedback}</p></Show>
      <Show when={item.hint}><p><b>Hint used:</b> {item.hint.text}</p></Show>
      <Show when={item.help}><p><b>You asked:</b> {item.help.question}</p><p>{item.help.answer}</p></Show>
      <Show when={item.sources?.length} fallback={<p>No source excerpt was saved with this entry.</p>}><For each={item.sources??[]}>{(source:any)=><div class="dd-sources"><h4>{source.path||'Saved work context'}</h4><small>{source.status}{source.at?` · ${source.at}`:''}</small><pre><code>{source.text}</code></pre><Show when={source.truncated}><small>Excerpt truncated.</small></Show></div>}</For></Show>
     </details>
    </article>}</For></div>
   </Show>
  </div>
  <footer class="lh-library-footer" aria-label="Saved learning navigation"><Show when={pages()>1} fallback={<span>{props.history.length} saved {props.history.length===1?'entry':'entries'}</span>}><button class="dd-secondary" disabled={page()===0} onClick={()=>changePage(page()-1)}>Previous</button><span>Page {page()+1} of {pages()}</span><button class="dd-secondary" disabled={page()+1>=pages()} onClick={()=>changePage(page()+1)}>Next</button></Show></footer>
 </section>;
}
