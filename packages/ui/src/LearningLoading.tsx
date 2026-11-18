import {animationLoop} from '../../experiences/src/animation-loop.js';
import {createSignal, onCleanup, onMount} from 'solid-js';

// Decorative motion is local and bounded: no network, generated code or fake progress.
export function LearningLoading(props:{assessment?:boolean; cancel:()=>void}) {
 const started=Date.now(),[elapsed,setElapsed]=createSignal(0);

 let canvas!:HTMLCanvasElement;
 onMount(()=>{
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const glyphs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ{}<>/=';
  let width=0,height=0,last=0,intersecting=true;
  type Drop={x:number;y:number;speed:number;length:number;glyphs:string[];wait:number;phase:number;flicker:number};
  let drops:Drop[]=[];
  const makeDrop=(x:number,initial=false):Drop=>({x,phase:Math.random()*Math.PI*2,flicker:.3+Math.random()*.65,y:initial?Math.random()*height:-20,speed:28+Math.random()*90,length:5+Math.floor(Math.random()*19),glyphs:Array.from({length:24},()=>glyphs[Math.floor(Math.random()*glyphs.length)]),wait:initial?0:Math.random()*2});
  const resize=()=>{width=canvas.clientWidth;height=canvas.clientHeight;const scale=Math.min(devicePixelRatio||1,1.5);canvas.width=width*scale;canvas.height=height*scale;ctx.setTransform(scale,0,0,scale,0,0);drops=[];for(let x=7+Math.random()*8;x<width;x+=13+Math.random()*13)drops.push(makeDrop(x,true));};
  const paint=(time:number)=>{
   const dt=last?Math.min((time-last)/1000,.1):0;last=time;ctx.clearRect(0,0,width,height);ctx.font='11px ui-monospace, monospace';ctx.textAlign='center';
   for(let i=0;i<drops.length;i++){
    const d=drops[i];if(d.wait>0){d.wait-=dt;continue;}
    if(!reduced.matches)d.y+=d.speed*dt;
    for(let j=0;j<d.length;j++){
     const y=d.y-j*22;if(y<0||y>height)continue;
     const shimmer=reduced.matches?1:Math.max(0,Math.min(1,(Math.sin(time/1000*d.flicker+d.phase)+.45)*1.6));
     const glyphFade=reduced.matches?1:.18+.82*Math.pow((Math.sin(time/1000*(1.4+(j%5)*.37)+d.phase+j*2.3)+1)/2,1.3);
     ctx.fillStyle=j===0?`rgba(225,222,230,${.6*shimmer})`:`rgba(170,166,180,${.38*Math.pow(1-j/d.length,1.6)*shimmer*glyphFade})`;
     ctx.fillText(d.glyphs[j],d.x,y);
    }
    if(!reduced.matches)for(let j=0;j<d.length;j++)if(Math.random()<dt*5)d.glyphs[j]=glyphs[Math.floor(Math.random()*glyphs.length)];
    if(d.y-d.length*22>height)drops[i]=makeDrop(d.x);
   }

  };
  const visible=()=>document.visibilityState==='visible'&&intersecting;
  const loop=animationLoop({draw:paint,visible,reduced:()=>reduced.matches});
  let clock:ReturnType<typeof setInterval>|undefined;
  const sync=()=>{last=0;loop.refresh();clearInterval(clock);if(visible()){setElapsed(Math.floor((Date.now()-started)/1000));clock=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);}};
  const observer=new ResizeObserver(()=>{resize();sync();});observer.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting??false;sync();});intersection.observe(canvas);
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);resize();sync();
  onCleanup(()=>{loop.stop();clearInterval(clock);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);});
 });
 return <section class="lh-loading-page" role="status" aria-live="polite">
  <canvas ref={canvas} class="lh-code-rain" aria-hidden="true"/>
  <span class="dd-kicker">{props.assessment?'Your thinking, considered':'Making the idea click'}</span>
  <h2>{props.assessment?'Checking your reasoning':'Preparing your learning experience'}</h2>
  <p>{elapsed()>=30?'This is taking longer than expected. You can cancel and return to your work.':props.assessment?'Looking at your answer and how you reached it.':'Building an explanation you can explore.'}</p>
  <small aria-live="off">{elapsed()}s elapsed</small>
  <button class="dd-link" onClick={props.cancel}>Cancel and pause learning</button>
 </section>;
}
