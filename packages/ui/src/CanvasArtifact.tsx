import {createMemo,Show} from 'solid-js';
import {validateCanvasArtifact,canvasFrame} from '../../experiences/src/canvas-artifact.js';
export function CanvasArtifact(props:{spec:any}){
 const safe=createMemo(()=>{try{return validateCanvasArtifact(props.spec);}catch{return null;}});
 const frame=createMemo(()=>safe()&&canvasFrame(safe()));
 return <Show when={safe()} fallback={<p role="alert">This interactive could not be loaded. Please create it again.</p>}><section class="dd-canvas" aria-label={safe()!.title}><h3>{safe()!.title}</h3><iframe title={safe()!.title} sandbox="allow-scripts" referrerpolicy="no-referrer" style={{width:'100%',height:safe()!.height+'px',border:'0','border-radius':'10px'}} srcdoc={frame() as string}/></section></Show>;
}
