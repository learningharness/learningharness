import {createSignal,createEffect,onMount,onCleanup,Show} from 'solid-js';
import {connect,notify} from '../desktop-runtime/web/bridge';
import {LearningLogo} from '../../packages/ui/src/LearningLogo';
// Claude owns expansion. Keep a compact instruction in the transcript rather
// than a second button whose iframe request can be refused by the host.
export function ClaudeLauncher(props:{children:any}){
 let card!:HTMLElement,observedMode:string|undefined;
 const [initialized,setInitialized]=createSignal(false),[expanded,setExpanded]=createSignal(false),[error,setError]=createSignal('');
 createEffect(()=>{const inline=!expanded();document.documentElement.toggleAttribute('data-inline-invitation',inline);if(!inline||!initialized()||!card)return;const report=()=>notify('ui/notifications/size-changed',{width:document.documentElement.clientWidth,height:Math.ceil(card.getBoundingClientRect().height)});const observer=new ResizeObserver(report);observer.observe(card);report();onCleanup(()=>observer.disconnect());});
 onCleanup(()=>document.documentElement.removeAttribute('data-inline-invitation'));
 function changed(event:MessageEvent){if(event.source===parent&&event.data?.method==='ui/notifications/host-context-changed'&&event.data.params?.displayMode){observedMode=event.data.params.displayMode;setExpanded(observedMode==='fullscreen');}}
 onMount(()=>{window.addEventListener('message',changed);void connect().then(result=>{setExpanded((observedMode??result.hostContext?.displayMode)==='fullscreen');setInitialized(true);}).catch(e=>setError(e.message));});
 onCleanup(()=>window.removeEventListener('message',changed));
 return <Show when={expanded()} fallback={<section ref={card} class="lh-invitation lh-claude-launcher"><p style={{display:'flex','align-items':'center',gap:'8px',margin:'0',padding:'10px 12px'}}><LearningLogo class="lh-invitation-mark"/><span>Click <strong>⤢ above</strong> to open Learn.</span></p><Show when={error()}><p role="status">{error()}</p></Show></section>}>{props.children}</Show>;
}
