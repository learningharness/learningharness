import {createSignal,onMount,createEffect,onCleanup,Show} from 'solid-js';
import {connect,tool,request,notify} from './bridge';
export function StartupInvitation(props:{open:()=>void}){
 const [state,setState]=createSignal<any>(),[error,setError]=createSignal(''),[busy,setBusy]=createSignal(false);
 let card!:HTMLDivElement;
 createEffect(()=>{document.documentElement.setAttribute('data-inline-invitation','');const observer=new ResizeObserver(()=>{const height=Math.ceil(card?.getBoundingClientRect().height??0);notify('ui/notifications/size-changed',{width:document.documentElement.clientWidth,height});});if(card)observer.observe(card);onCleanup(()=>observer.disconnect());});
 onCleanup(()=>document.documentElement.removeAttribute('data-inline-invitation'));
 onMount(async()=>{try{await connect();setState(await tool('claim_startup_view'));}catch(e:any){setError(e.message);}});
 async function act(open:boolean){setBusy(true);setError('');try{if(open)await request('ui/request-display-mode',{mode:'fullscreen'});await tool('dismiss_startup_invitation');if(open)props.open();else setState({...state(),dismissed:true});}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <div ref={card} class="lh-startup"><Show when={state()&&!state().dismissed}><div role="status"><strong>LearningHarness is {state().on?'On':'Off'}</strong><p>{state().on?'Learn alongside your work. Your coding agent keeps going.':'Open LearningHarness to turn learning on for your coding chats.'}</p></div><div class="lh-startup-actions"><button disabled={busy()} onClick={()=>void act(true)}>Open LearningHarness ↗</button><button disabled={busy()} onClick={()=>void act(false)}>Dismiss</button></div></Show><Show when={error()}><p role="alert">{error()}</p></Show></div>;
}
