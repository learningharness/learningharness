// Decorative work must sleep completely while hidden or reduced-motion is on.
export function animationLoop({draw,visible,reduced,setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now(),interval=50}){
 let timer=null,stopped=false;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 const tick=()=>{timer=null;if(stopped||!visible())return;draw(now());if(!reduced())timer=setTimer(tick,interval);};
 return {refresh(){cancel();if(!stopped&&visible())tick();},stop(){stopped=true;cancel();}};
}
