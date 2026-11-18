import {createSignal,createEffect,For,Show} from 'solid-js';
export function FlashcardDeck(props:{moment:any;disabled:boolean;command:(action:string,value?:any)=>Promise<any>}){
 const deck=()=>props.moment.deck,card=()=>deck().cards[deck().position];
 const [back,setBack]=createSignal(false);let shown='';
 createEffect(()=>{const key=`${props.moment.id}:${card().id}`;if(key!==shown){shown=key;setBack(false);}});
 const rated=()=>Object.keys(deck().ratings).length,known=()=>Object.values(deck().ratings).filter(v=>v==='remembered').length;
 const flip=async()=>{if(props.disabled)return;if(back()){setBack(false);return;}const id=card().id;if(!card().back){const result=await props.command('deck-reveal',{cardId:id});if(!result)return;}if(card().id===id)setBack(true);};
 return <section class="lh-deck" aria-label="Flashcard deck" aria-busy={props.disabled}>
  <div class="lh-deck-heading"><span>{deck().cards.length} cards</span><span>{rated()} reviewed</span></div>
  <div class="lh-deck-progress" role="progressbar" aria-label="Cards reviewed" aria-valuenow={rated()} aria-valuemin={0} aria-valuemax={deck().cards.length}><span style={{width:`${rated()/deck().cards.length*100}%`}}/></div>
  <button class="lh-deck-card" classList={{'is-back':back()}} disabled={props.disabled} onClick={()=>void flip()} aria-label={back()?'Flip to question':'Flip to answer'}>
   <span class="lh-deck-flipper">
    <span class="lh-deck-face lh-deck-front" aria-hidden={back()}><span class="lh-deck-face-top"><span class="lh-card-label">QUESTION</span><span>{deck().position+1} / {deck().cards.length}</span></span><span class="lh-deck-content">{card().front}</span><span class="lh-deck-hint">Flip to check ↗</span></span>
    <span class="lh-deck-face lh-deck-back" aria-hidden={!back()}><span class="lh-deck-face-top"><span class="lh-card-label">ANSWER</span><span>{deck().position+1} / {deck().cards.length}</span></span><span class="lh-deck-content">{card().back}</span><span class="lh-deck-hint">Back to question ↶</span></span>
   </span>
  </button>
  <Show when={back()&&!deck().ratings[card().id]} fallback={<p class="lh-deck-note">{deck().ratings[card().id]==='remembered'?'You recalled this.':deck().ratings[card().id]==='missed'?'You marked this for more practice.':'Think of your answer before flipping.'}</p>}><div class="lh-deck-ratings"><span>How did you do?</span><button class="lh-deck-rate" disabled={props.disabled} onClick={()=>void props.command('deck-rate',{cardId:card().id,rating:'missed'})}>Not yet</button><button class="lh-deck-rate known" disabled={props.disabled} onClick={()=>void props.command('deck-rate',{cardId:card().id,rating:'remembered'})}>I knew this</button></div></Show>
  <nav class="lh-deck-nav" aria-label="Deck navigation"><button class="lh-deck-nav-button" aria-label="Previous card" disabled={props.disabled||deck().position===0} onClick={()=>void props.command('deck-navigate',{index:deck().position-1})}>←</button><span>Card {deck().position+1} of {deck().cards.length}</span><button class="lh-deck-nav-button" aria-label="Next card" disabled={props.disabled||deck().position===deck().cards.length-1} onClick={()=>void props.command('deck-navigate',{index:deck().position+1})}>→</button></nav>
  <Show when={rated()===deck().cards.length}><div class="lh-deck-summary" role="status"><strong>Deck reviewed</strong><p>{known()} recalled · {deck().cards.length-known()} to revisit</p><p class="lh-deck-note">Your ratings help choose future practice. They aren’t an assessment of mastery.</p></div></Show>
 </section>;
}
