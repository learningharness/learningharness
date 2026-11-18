import {hierarchy,tree} from 'd3-hierarchy';
import {createMemo,createSignal,createEffect,onMount,onCleanup,For,Show} from 'solid-js';
import {validateMindMap,mindMapFitScale} from '../../experiences/src/mind-map.js';
function Branch(props:{node:any}){return <li>{props.node.label}<Show when={props.node.children.length}><ul><For each={props.node.children}>{node=><Branch node={node}/>}</For></ul></Show></li>;}
export function MindMap(props:{spec:any}){
 const [collapsed,setCollapsed]=createSignal<Set<string>>(new Set()),[zoom,setZoom]=createSignal(1);
 const [autoFit,setAutoFit]=createSignal(true);
 const [viewportSize,setViewportSize]=createSignal({width:0,height:0});let viewport:HTMLDivElement|undefined;
 const map=createMemo(()=>{try{return validateMindMap(props.spec);}catch{return null;}});
 createEffect(()=>{props.spec;setCollapsed(new Set<string>());setAutoFit(true);setZoom(1);});
 const layout=createMemo(()=>{
  if(!map())return null;
  const tag=(node:any,key='root'):any=>({...node,key,children:node.children.map((c:any,i:number)=>tag(c,`${key}-${i}`))});
  const root=hierarchy(tag(map()!.root),(d:any)=>collapsed().has(d.key)?null:d.children);
  tree().nodeSize([76,200])(root);
  const nodes:any[]=root.descendants(),min=Math.min(...nodes.map(n=>n.x)),max=Math.max(...nodes.map(n=>n.x));
  return {nodes,links:root.links(),width:Math.max(...nodes.map(n=>n.y))+200,height:max-min+100,offset:50-min};
 });
 const fit=()=>{setAutoFit(true);const size=viewportSize(),content=layout();if(content&&size.width&&size.height)setZoom(mindMapFitScale(content.width,content.height,size.width,size.height));};
 createEffect(()=>{layout();viewportSize();if(autoFit())fit();});
 onMount(()=>{if(!viewport)return;const measure=()=>setViewportSize({width:viewport!.clientWidth,height:viewport!.clientHeight});const observer=new ResizeObserver(measure);observer.observe(viewport);measure();onCleanup(()=>observer.disconnect());});
 const toggle=(key:string)=>setCollapsed(old=>{const next=new Set(old);next.has(key)?next.delete(key):next.add(key);return next;});
 return <Show when={map()&&layout()} fallback={<p class="dd-muted">This saved map is unavailable.</p>}><section class="lh-mind-map" aria-label={`Mind map: ${map()!.title}`}>
  <div class="lh-map-heading"><h3>{map()!.title}</h3><div><button class="dd-link" aria-label="Zoom out of mind map" disabled={zoom()<=.1} onClick={()=>{setAutoFit(false);setZoom(z=>Math.max(.1,z-.15));}}>−</button><button class="dd-link" aria-label="Fit mind map to panel" onClick={fit}>Fit</button><button class="dd-link" aria-label="Zoom into mind map" disabled={zoom()>=1.6} onClick={()=>{setAutoFit(false);setZoom(z=>Math.min(1.6,z+.15));}}>+</button></div></div>
  <p class="lh-map-note">Zoom in for detail. Scroll both ways to explore; Fit shows the whole map.</p>
  <div ref={viewport} class="lh-map-viewport" tabindex="0" aria-label="Scrollable mind map"><svg width={layout()!.width*zoom()} height={layout()!.height*zoom()} viewBox={`0 0 ${layout()!.width} ${layout()!.height}`} role="group" aria-label="Concept relationships">
   <For each={layout()!.links}>{(link:any)=><path d={`M${link.source.y+176},${link.source.x+layout()!.offset} C${link.source.y+188},${link.source.x+layout()!.offset} ${link.target.y-12},${link.target.x+layout()!.offset} ${link.target.y},${link.target.x+layout()!.offset}`} fill="none" stroke="#bba49b" stroke-opacity=".45" stroke-width="1.5"/>}</For>
   <For each={layout()!.nodes}>{(node:any)=><g transform={`translate(${node.y},${node.x+layout()!.offset-29})`} role={node.data.children.length?'button':'group'} tabindex={node.data.children.length?0:undefined} aria-label={node.data.label} aria-expanded={node.data.children.length?!collapsed().has(node.data.key):undefined} onClick={()=>node.data.children.length&&toggle(node.data.key)} onKeyDown={e=>{if(node.data.children.length&&['Enter',' '].includes(e.key)){e.preventDefault();toggle(node.data.key);}}}>
    <title>{node.data.label}</title><rect width="176" height="58" rx="10" fill={node.depth===0?'#44312b':'#28272c'} stroke={node.depth===0?'#f2a88a':'#5a5050'}/><text x="12" y="22" fill="#f1ebea" font-size="12"><For each={node.data.label.match(/.{1,23}(?:\s|$)|.{1,23}/g)?.slice(0,3)??[]}>{(line:string,index)=><tspan x="12" dy={index()===0?0:13}>{line.trim()}</tspan>}</For></text><Show when={node.data.children.length}><text x="164" y="50" text-anchor="end" fill="#f2a88a" font-size="12">{collapsed().has(node.data.key)?'+':'−'}</text></Show>
   </g>}</For>
  </svg></div><details class="lh-map-text"><summary>Text outline</summary><ul><Branch node={map()!.root}/></ul></details>
 </section></Show>;
}
