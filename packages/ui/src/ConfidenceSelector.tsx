import {For} from 'solid-js';
export function ConfidenceSelector(props:{value:string|null;disabled:boolean;onChange:(value:string)=>void}){
 return <fieldset class="lh-confidence" disabled={props.disabled}><legend>How sure are you?</legend><div><For each={['low','medium','high']}>{level=><label data-level={level} classList={{selected:props.value===level}}><input type="radio" name="learning-confidence" value={level} checked={props.value===level} onChange={()=>props.onChange(level)}/><span>{level[0].toUpperCase()+level.slice(1)}</span></label>}</For></div></fieldset>;
}
