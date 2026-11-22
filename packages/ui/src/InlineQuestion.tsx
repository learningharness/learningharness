import {createSignal,For,Show,onCleanup,onMount} from 'solid-js';
import {quickQuestion} from '../../experiences/src/inline-question.js';
import {ConfidenceSelector} from './ConfidenceSelector.js';
import {dontDumbRpc} from './host-contract.js';

// A deliberately small surface. The full companion is never mounted here.
export function InlineQuestion(props:{session:any;onExpand:(momentId?:string)=>Promise<void>}) {
 const [state,setState]=createSignal<any>();
 const [answer,setAnswer]=createSignal(''),[choice,setChoice]=createSignal('');
 const [confidence,setConfidence]=createSignal<string|null>(null);
 const [busy,setBusy]=createSignal(false),[error,setError]=createSignal(''),[stale,setStale]=createSignal(false);
 const rpc=()=>props.session.server.client.rpc(dontDumbRpc as any);
 const session=()=>state()?.session;
 const question=()=>state()?.settings?.allowInline===false?null:quickQuestion(session()?.moment);
 const enabled=()=>state()?.enabled&&!state()?.globallyStopped&&!session()?.paused&&!stale();
 let momentId:string|undefined,stop:(()=>void)|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 let pendingDraft:any=null,write=Promise.resolve();let disposed=false;
 const accept=(next:any)=>{
  if(momentId&&next?.session?.moment?.id!==momentId){setStale(true);return;}
  const first=!momentId;momentId=next?.session?.moment?.id;
  setState(next);
  if(first){setAnswer(next?.session?.draft?.answer??'');setChoice(next?.session?.draft?.choice??'');setConfidence(next?.session?.draft?.confidence??null);}
 };
 const refresh=async()=>{try{const next=await rpc().status({sessionID:props.session.id});if(!disposed)accept(next);}catch{if(!disposed)setError('Could not reconnect. Your answer stays here.');}};
 const flush=()=>{
  clearTimeout(timer);
  if(pendingDraft){const value=pendingDraft;pendingDraft=null;write=write.catch(()=>{}).then(()=>rpc().command({action:'save-draft',sessionID:props.session.id,value}));}
  return write;
 };
 const save=(text:string,selected:string,certainty=confidence())=>{
  setAnswer(text);setChoice(selected);setConfidence(certainty);
  pendingDraft={momentId,answer:text,choice:selected,confidence:certainty};clearTimeout(timer);
  timer=setTimeout(()=>void flush().catch(()=>setError('Could not save yet. Your answer stays here.')),250);
 };
 const expand=async()=>{setError('');try{if(stale())await flush().catch(()=>{});else await flush();await props.onExpand(stale()?undefined:momentId);}catch(e:any){setError(e.message||'Could not open the sidebar. Your answer stays here.');}};
 const submit=async()=>{
  if(busy()||!enabled()||!question())return;setBusy(true);setError('');
  try{await flush();const next=await rpc().command({action:'submit',sessionID:props.session.id,expectedMomentId:momentId,value:{answer:choice()||answer(),confidence:confidence()}});if(!disposed)accept(next);}
  catch(e:any){if(!disposed)setError(e.message||'Could not check this answer. Try again.');}
  finally{if(!disposed)setBusy(false);}
 };
 onMount(()=>{void refresh();stop=rpc().events.on('updated',()=>void refresh());});
 onCleanup(()=>{disposed=true;stop?.();void flush().catch(()=>{});});
 return <section class="lh-quick-question" aria-label="Quick learning question">
  <Show when={question()} fallback={<p>Open this learning moment in the sidebar.</p>}>{item=><>
   <span class="lh-quick-label">{item().kind==='predict'?'Quick prediction':'Quick quiz'}</span>
   <Show when={item().context}><p class="lh-quick-context">{item().context}</p></Show>
   <h2>{item().question}</h2>
   <Show when={item().choices.length} fallback={
    <textarea aria-label="Your prediction" rows={2} maxLength={4000} value={answer()} disabled={busy()||!enabled()||!!session()?.feedback}
     onInput={e=>save(e.currentTarget.value,'')} placeholder="What do you think will happen?"/>
   }><div class="lh-quick-choices"><For each={item().choices}>{(text:string,index)=><label classList={{selected:(session()?.feedback?.answer??choice())===text}}>
    <input type="radio" name="quick-answer" checked={(session()?.feedback?.answer??choice())===text}
     disabled={busy()||!enabled()||!!session()?.feedback} onChange={()=>save('',text,null)}/>
    <span>{String.fromCharCode(65+index())}. {text}</span>
   </label>}</For></div></Show>
   <Show when={!session()?.feedback}>
    <Show when={answer().trim()||choice()}><ConfidenceSelector value={confidence()} disabled={busy()||!enabled()} onChange={value=>save(answer(),choice(),value)}/></Show>
    <button class="lh-quick-submit" disabled={busy()||!enabled()||!confidence()||!(choice()||answer()).trim()} onClick={()=>void submit()}>{busy()?'Checking…':'Check answer'}</button>
   </Show>
   <Show when={session()?.feedback}><p class="lh-quick-feedback" role="status"><strong>{session().feedback.verdict==='correct'?'Correct.':session().feedback.verdict==='partial'?'Partly right.':'Not quite.'}</strong> {String(session().feedback.feedback??'').slice(0,300)}</p></Show>
  </>}</Show>
  <Show when={stale()}><p role="status">Another step is open. Open the sidebar to continue.</p></Show>
  <Show when={state()&&!enabled()&&!stale()}><p role="status">Learning is off or paused.</p></Show>
  <Show when={error()}><p class="lh-quick-error" role="alert">{error()}</p></Show>
  <button class="lh-quick-expand" disabled={busy()} onClick={()=>void expand()}>Open in sidebar ↗</button>
 </section>;
}
