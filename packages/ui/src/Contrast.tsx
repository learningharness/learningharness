import {For} from 'solid-js';
export function Contrast(props:{value:{varied:string,cases:{label:string,situation:string,result:string}[]}}){
 return <section class="lh-contrast" aria-label="Compare two cases"><p class="lh-contrast-varied"><b>What changes:</b> {props.value.varied}</p><div class="lh-contrast-cases"><For each={props.value.cases}>{item=><article><h3>{item.label}</h3><p>{item.situation}</p><p class="lh-contrast-result"><b>Result:</b> {item.result}</p></article>}</For></div><p class="dd-muted">Compare the outcomes. What makes the difference?</p></section>;
}
