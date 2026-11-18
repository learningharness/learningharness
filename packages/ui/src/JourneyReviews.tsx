import {For,Show} from 'solid-js';
export function JourneyReviews(props:{reviews:any[],now:string,disabled:boolean,onReview:(key:string)=>void}){
 const due=()=>props.reviews.filter(item=>Date.parse(item.dueAt)<=Date.parse(props.now));
 return <section class="lh-journey-reviews" aria-label="Spaced learning reviews"><h2>Return to an idea</h2><p>Revisit important ideas over time and see what you can explain now.</p><Show when={due().length} fallback={<p class="dd-muted">Nothing is due yet. You can reopen saved learning below.</p>}><For each={due()}>{topic=><article><h3>{topic.objective}</h3><Show when={topic.sessionTitle||topic.project}><small>From {topic.sessionTitle||topic.project}</small></Show><button class="dd-secondary" disabled={props.disabled} onClick={()=>props.onReview(topic.key)}>Review this idea</button></article>}</For></Show></section>;
}
