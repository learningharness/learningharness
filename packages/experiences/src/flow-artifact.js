import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';
import {validateVisualArtifact} from './visual-artifact.js';
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(value,x,y,width=22)=>{
 const words=value.split(/\s+/).flatMap(word=>word.match(new RegExp('.{1,'+width+'}', 'g'))??[]),lines=[''];
 for(const word of words){const last=lines.length-1;if((lines[last]+' '+word).trim().length>width&&lines[last])lines.push(word);else lines[last]=(lines[last]+' '+word).trim();}
 return `<text x="${x}" y="${y}" text-anchor="middle" fill="#f1f0f8" font-size="16">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?21:0}">${escape(line)}</tspan>`).join('')}</text>`;
};
// Content contains state and transitions; the renderer owns all SVG geometry.
export function compileFlowArtifact(spec){
 exactObject(spec,['format','title','participants','steps']);
 if(spec.format!=='flow')throw new Error('Expected flow artifact');
 nonEmptyString(spec.title,'$.title',80);
 if(!Array.isArray(spec.participants)||spec.participants.length<2||spec.participants.length>4)throw new Error('Flow needs 2–4 participants');
 if(!Array.isArray(spec.steps)||spec.steps.length<2||spec.steps.length>6)throw new Error('Flow needs 2–6 steps');
 spec.participants.forEach(label=>nonEmptyString(label,'$.participant',32));
 const x=index=>80+index*560/(spec.participants.length-1);
 const box=(index,color)=>`<rect x="${x(index)-74}" y="30" width="148" height="130" rx="12" fill="${color}" stroke="#9b96ef"/>`;
 const scene=spec.participants.map((name,i)=>box(i,'#242638')+text(name,x(i),59,16)).join('');
 const steps=spec.steps.map(step=>{
  exactObject(step,['title','body','from','to','states','message','blocked'],['title','body','from','to']);
  nonEmptyString(step.title,'$.step.title',80);nonEmptyString(step.body,'$.step.body',220);
  if(![step.from,step.to].every(i=>Number.isInteger(i)&&i>=0&&i<spec.participants.length))throw new Error('Unknown flow participant');
  if(step.states!==undefined){if(!Array.isArray(step.states)||step.states.length!==spec.participants.length)throw Error('One current state per participant is required');step.states.forEach(s=>nonEmptyString(s,'$.step.state',40));}
  if(step.message!==undefined)nonEmptyString(step.message,'$.step.message',56);
  if(step.blocked!==undefined&&typeof step.blocked!=='boolean')throw Error('Invalid blocked transition');
  const a=x(step.from),b=x(step.to),path=a===b?`M${a} 175 C${a+55} 190 ${a+55} 235 ${a} 245`:`M${a} 195 L${b} 195`;
  const color=step.blocked?'#ef9a9a':'#a9a0ff';
  const route=`<path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>`;
  const marker=step.blocked?`<path d="M${b-8} 187 L${b+8} 203 M${b+8} 187 L${b-8} 203" stroke="${color}" stroke-width="4"/>`:`<circle r="6" fill="#8ce3d0"><animateMotion path="${path}" dur="1.5s" repeatCount="indefinite"/></circle>`;
  return {title:step.title,body:step.body,...(step.states?{state:step.states.map((value,i)=>({label:spec.participants[i],value}))}:{}),overlay:box(step.to,'#454064')+text(spec.participants[step.to],x(step.to),59,16)+(step.states??[]).map((value,i)=>text(value,x(i),112,18)).join('')+route+marker+(step.message?text(step.message,360,275,44):'')};
 });
 return validateVisualArtifact({format:'visual',title:spec.title,viewBox:'0 0 720 330',scene,scenarios:[{label:'Step through',steps}],caption:'Compare the values at each step. A crossed route is blocked; a moving signal is delivered.'});
}
const str=maxLength=>({type:'string',minLength:1,maxLength});
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const flowArtifactSchema=obj({format:{type:'string',enum:['flow']},title:str(80),participants:{type:'array',minItems:2,maxItems:4,items:str(32)},steps:{type:'array',minItems:2,maxItems:6,items:obj({title:str(80),body:str(220),from:{type:'integer',minimum:0,maximum:3},to:{type:'integer',minimum:0,maximum:3},states:{type:'array',minItems:2,maxItems:4,items:str(40)},message:str(56),blocked:{type:'boolean'}})}});
export const flowArtifactInstructions='For a process, return compact semantic flow data: {"format":"flow","title":"Short title","participants":["Reader","Version","Cache"],"steps":[{"title":"Read starts","body":"The read remembers the current version.","from":0,"to":2,"states":["captured: 4","current: 4","empty"],"message":"GET pending","blocked":false},{"title":"Old refill rejected","body":"A successful write changed the version before this read finished.","from":0,"to":2,"states":["delivered to caller","current: 5","empty"],"message":"4 ≠ 5: reject refill","blocked":true}]}. Use 2–4 participants, 3–5 steps. Each step must show the current value/status of EVERY participant in states (same order, <=40 characters each), label the transition in message, and set blocked:true only for a rejected transition. Show concrete changing values, before/after and the causal check; moving dots alone do not explain a mechanism. Distinguish delivery to caller from storage. Use illustrative values only when stated, never claim inferred code was implemented. Do not reveal an unanswered probe. The app draws all geometry; no SVG/HTML/code. Keep JSON concise.';
