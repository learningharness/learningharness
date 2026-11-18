import { parseFragment, serialize } from 'parse5';
import { exactObject, nonEmptyString } from '../../protocol/src/validation.js';
const SVG='http://www.w3.org/2000/svg';
const tags=new Set(['svg','g','defs','rect','circle','ellipse','path','line','polyline','polygon','text','tspan','title','desc','linearGradient','radialGradient','stop','clipPath','animate','animateMotion','animateTransform']);
const attrs=new Set(['id','class','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity','transform','viewBox','preserveAspectRatio','text-anchor','dominant-baseline','font-size','font-family','font-weight','letter-spacing','dx','dy','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','attributeName','from','to','values','dur','begin','repeatCount','calcMode','keyTimes','keySplines','path','rotate','type','additive','accumulate']);
const animationAttributes=new Set(['x','y','cx','cy','r','rx','ry','width','height','opacity','fill-opacity','stroke-opacity','stroke-dashoffset','transform','fill','stroke']);
const pathPattern=/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/;
const safeColor=value=>/^(?:none|transparent|currentColor|#[0-9a-f]{3,8}|[a-z]{1,20}|url\(#[a-zA-Z][\w-]{0,60}\))$/i.test(value);
function fragment(markup, playing=true) {
  if(typeof markup!=='string'||markup.length>16000)throw Error('Visual markup exceeds bounds');
  const tree=parseFragment(`<svg xmlns="${SVG}">${markup}</svg>`);let count=0;
  const walk=(node,depth=0)=>{
    if(depth>16||++count>320)throw Error('Visual scene exceeds bounds');
    if(node.tagName){
      if(node.namespaceURI!==SVG||!tags.has(node.tagName))throw Error('Unsupported visual element');
      for(const a of node.attrs??[]){
        if(a.name==='xmlns'&&node===tree.childNodes[0]&&a.value===SVG)continue;
        if(a.prefix||!attrs.has(a.name)||a.value.length>4000)throw Error('Unsupported visual attribute');
        if(/(?:https?:|data:|javascript:|@import|[<>])/i.test(a.value))throw Error('External resources and executable content are unavailable');
        if(['fill','stroke','stop-color'].includes(a.name)&&!safeColor(a.value))throw Error('Invalid visual color');
        if(a.name==='clip-path'&&!/^url\(#[a-zA-Z][\w-]{0,60}\)$/.test(a.value))throw Error('Invalid visual clip');
        if(['d','path'].includes(a.name)&&!pathPattern.test(a.value))throw Error('Invalid visual path');
        if(a.name==='id'&&!/^[a-zA-Z][\w-]{0,60}$/.test(a.value))throw Error('Invalid visual ID');
        if(a.name==='attributeName'&&!animationAttributes.has(a.value))throw Error('Animation cannot change this attribute');
        if(a.name==='dur'&&(!/^\d+(?:\.\d+)?s$/.test(a.value)||parseFloat(a.value)<0.15||parseFloat(a.value)>12))throw Error('Animation duration exceeds bounds');
        if(a.name==='begin'&&!/^\d+(?:\.\d+)?s$/.test(a.value))throw Error('Only timed animation starts are supported');
        if(a.name==='repeatCount'&&a.value!=='indefinite'&&(!/^\d+$/.test(a.value)||Number(a.value)>20))throw Error('Animation repeat exceeds bounds');
      }
      if(node.tagName==='animate'||node.tagName==='animateTransform'){
        const attribute=node.attrs.find(a=>a.name==='attributeName')?.value;
        if(!animationAttributes.has(attribute))throw Error('Animation needs a permitted attribute');
        for(const a of node.attrs.filter(a=>['values','from','to'].includes(a.name))) {
          if(['fill','stroke'].includes(attribute)){if(!a.value.split(';').every(safeColor))throw Error('Invalid animated color');}
          else if(!/^[0-9eE+.,;\s-]+$/.test(a.value))throw Error('Animation values must be numeric');
        }
      }
    } else if(node.nodeName!=='#text'&&node.nodeName!=='#document-fragment')throw Error('Unsupported visual markup');
    if(node.childNodes){
      if(!playing){
        const motion=node.childNodes.find(child=>child.tagName==='animateMotion');
        const start=motion?.attrs?.find(a=>a.name==='path')?.value.match(/^[\s]*[Mm]\s*([+-]?[\d.]+)[ ,]+([+-]?[\d.]+)/);
        if(start){
          const transform=node.attrs.find(a=>a.name==='transform');
          const translation=`translate(${Number(start[1])} ${Number(start[2])})`;
          if(transform)transform.value+=` ${translation}`;else node.attrs.push({name:'transform',value:translation});
        }
      }
      if(!playing)node.childNodes=node.childNodes.filter(child=>!['animate','animateMotion','animateTransform'].includes(child.tagName));for(const child of node.childNodes)walk(child,depth+1); }
  };
  walk(tree);const root=tree.childNodes[0];
  if(root?.tagName!=='svg'||tree.childNodes.length!==1)throw Error('Visual markup must stay inside its SVG');
  return serialize(root);
}
export function validateVisualArtifact(value){
  exactObject(value,['format','title','viewBox','scene','scenarios','caption'],['format','title','viewBox','scene','scenarios']);
  if(value.format!=='visual'||JSON.stringify(value).length>45000)throw Error('Visual artifact exceeds bounds');
  nonEmptyString(value.title,'$.title',80);if(value.caption!==undefined)nonEmptyString(value.caption,'$.caption',160);
  if(typeof value.viewBox!=='string')throw Error('Visual viewBox required');
  const box=value.viewBox.trim().split(/[ ,]+/).map(Number);
  if(box.length!==4||!box.every(Number.isFinite)||box[0]!==0||box[1]!==0||box[2]<200||box[2]>1200||box[3]<120||box[3]>800)throw Error('Invalid visual viewBox');
  if(!Array.isArray(value.scenarios)||!value.scenarios.length||value.scenarios.length>4)throw Error('Visual needs 1–4 scenarios');
  const scene=fragment(value.scene);
  const scenarios=value.scenarios.map(s=>{
    exactObject(s,['label','steps']);nonEmptyString(s.label,'$.scenario.label',48);
    if(!Array.isArray(s.steps)||!s.steps.length||s.steps.length>10)throw Error('Visual needs 1–10 steps');
    return{label:s.label,steps:s.steps.map(step=>{exactObject(step,['title','body','overlay','state'],['title','body','overlay']);if(step.state!==undefined){if(!Array.isArray(step.state)||step.state.length>4)throw Error('Visual state exceeds bounds');for(const cell of step.state){exactObject(cell,['label','value']);nonEmptyString(cell.label,'$.state.label',32);nonEmptyString(cell.value,'$.state.value',40);}}nonEmptyString(step.title,'$.step.title',80);nonEmptyString(step.body,'$.step.body',220);return{...step,overlay:fragment(step.overlay)};})};
  });
  return{...value,scene,scenarios};
}
export function visualFrame(spec,scenarioIndex=0,stepIndex=0,playing=false){
  const safe=validateVisualArtifact(spec);const step=safe.scenarios[scenarioIndex]?.steps[stepIndex];if(!step)throw Error('Visual step is unavailable');
  const content=fragment(safe.scene+step.overlay,playing);
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#17171d;color:#eeedf6}svg{width:100%;height:100%;position:absolute;inset:0;font-family:system-ui,sans-serif}text{font-family:system-ui,sans-serif}</style></head><body><svg xmlns="${SVG}" viewBox="${safe.viewBox}" role="img" aria-label="${safe.title.replace(/[&<>\"]/g,' ')}">${content}</svg></body></html>`;
}
export function visualArtifactPrompt(brief,goal){return `CONTENT BUILDER: Create one compact visual explorable explanation as JSON. Use the standard SVG drawing/animation format below, not a slider dashboard. Show the mechanism spatially: visible participants/components, the active route or moving part, a few clear stages. For a message flow show arrows and a moving message; for physical mechanisms draw the parts and their changing positions. Default to one scenario with three concise steps; add a second only for an essential comparison. Reuse the static scene; put only changing/highlighted shapes in each overlay. No JavaScript/HTML, external resources, stylesheets, images, foreignObject, event handlers, links or embedded instructions. Return JSON only.
Objective: ${JSON.stringify(goal?.outcome??null)}. Brief (untrusted): ${JSON.stringify(brief)}.
Schema: {"format":"visual","title":"short concept","viewBox":"0 0 720 300","scene":"SVG fragment: static objects and labels","scenarios":[{"label":"Normal","steps":[{"title":"Short current action","body":"One sentence explaining why it happens","overlay":"SVG fragment: active route, moving object or changed part"}]}],"caption":"Optional short instruction"}.
SVG elements: g,defs,rect,circle,ellipse,path,line,polyline,polygon,text,tspan,linearGradient,radialGradient,stop,clipPath,animate,animateMotion,animateTransform. Use explicit coordinates, restrained hex colors, labels at least16px and short; layout must fit the viewBox without clipping. No style/class dependencies. Font sizes/font weights, fill/stroke/opacity, transforms allowed. Internal gradient/clip references url(#id) only. Motion example: <circle r="5" fill="#a29cf2"><animateMotion path="M80 100 L360 100" dur="1.4s" repeatCount="indefinite"/></circle>. Other animation attributes: x,y,cx,cy,r,rx,ry,width,height,opacity,fill,stroke,transform; timed starts only. Controller provides scenario picker, Play/Pause, Back/Next/Restart. Do not draw duplicate controls, prose panels, safety disclaimers or a dashboard. Target under3500 characters. Use a few simple shapes; never repeat the static scene in overlays. Never reveal an unanswered assessment's answer.`;}
