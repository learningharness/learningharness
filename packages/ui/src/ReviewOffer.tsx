import {createEffect, onCleanup} from 'solid-js';

export function ReviewOffer(props:{offer:any;reminder:any;busy:boolean;command:(action:string,value?:any)=>any;acknowledge:(id:string)=>Promise<any>}) {
 let element!:HTMLElement;
 createEffect(()=>{
  const reminder=props.reminder;
  if(!reminder?.id||reminder.acknowledgedAt)return;
  let received=false,intersects=false;
  const acknowledge=()=>{
   if(received||!intersects||document.visibilityState!=='visible')return;
   const box=element.getBoundingClientRect();
   if(box.bottom<=0||box.top>=innerHeight||box.width<=0||box.height<=0)return;
   received=true;void props.acknowledge(reminder.id).catch(()=>{received=false;});
  };
  const observer=new IntersectionObserver(entries=>{intersects=entries.some(entry=>entry.isIntersecting);if(intersects)acknowledge();});
  observer.observe(element);document.addEventListener('visibilitychange',acknowledge);
  onCleanup(()=>{observer.disconnect();document.removeEventListener('visibilitychange',acknowledge);});
 });
 return <aside ref={element} class="dd-now" aria-label="Due learning review"><span class="dd-kicker">{props.reminder?'Worth revisiting today':'Quick refresher · 1 min'}</span><h2>{props.offer.objective}</h2><p>{props.offer.whyNow}</p><button class="dd-secondary" disabled={props.busy} onClick={()=>void props.command('start-review')}>Quick check</button><button class="dd-link" disabled={props.busy} onClick={()=>void props.command('skip-review')}>Skip for today</button></aside>;
}
