import {exactObject,nonEmptyString} from '../../protocol/src/validation.js';

const string=maxLength=>({type:'string',minLength:1,maxLength});
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const sources={type:'array',minItems:1,maxItems:6,items:string(200)};
export const graphDeltaSchema=object({
 topics:{type:'array',maxItems:3,items:object({ref:string(32),conceptId:{type:'string',maxLength:120},label:string(80),definition:string(240),sourceIds:sources})},
 relationships:{type:'array',maxItems:4,items:object({subject:string(32),predicate:{type:'string',enum:['skos:broader','skos:related','lh:usedTogetherIn']},object:string(32),sourceIds:sources})},
});
export const emptyWorkGraph=()=>({version:1,concepts:[],relationships:[],encounters:[],checkpoints:[]});
const key=value=>String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const words=value=>new Set(key(value).match(/[\p{L}\p{N}]{3,}/gu)??[]);
const basis=type=>type==='task.submitted'?'task_intent':type==='assistant.ended'?'public_explanation':type==='tool.input.ended'?'proposed_input':'captured_observation';
export function workGraphContext(graph,query,scope){
 if(!Array.isArray(graph?.concepts))return [];
 const terms=words(query),score=c=>[...words(c.label+' '+c.definition)].filter(w=>terms.has(w)).length;
 const selected=[];
 for(const c of graph.concepts.filter(c=>c&&typeof c.id==='string'&&typeof c.label==='string'&&typeof c.definition==='string'&&c.scope===scope&&score(c)>0).sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))){
  const item={id:c.id,label:c.label,definition:c.definition};
  if(selected.length<6&&JSON.stringify([...selected,item]).length<=1800)selected.push(item);
 }
 return selected;
}
// Pure local projection. Model output never creates assessments, executes code,
// or edits an existing concept's definition. All relationships remain proposals.
export function applyWorkGraphDelta(current,delta,context){
 exactObject(delta,['topics','relationships']);
 if(!Array.isArray(delta.topics)||delta.topics.length>3||!Array.isArray(delta.relationships)||delta.relationships.length>4||JSON.stringify(delta).length>6000)throw Error('Graph delta exceeds bounds');
 nonEmptyString(context.checkpointId,'checkpoint',300);nonEmptyString(context.scope,'scope',240);
 if(!Number.isFinite(Date.parse(context.createdAt)))throw Error('Invalid graph timestamp');
 const graph=current??emptyWorkGraph();
 if(graph.version!==1||!['concepts','relationships','encounters','checkpoints'].every(field=>Array.isArray(graph[field])))throw Error('Unsupported work graph');
 if(graph.checkpoints.includes(context.checkpointId))return structuredClone(graph);
 const next=structuredClone(graph),refs=new Map();
 const sourceMap=new Map(context.sources.map(s=>[s.id,s]));
 const resolveSources=ids=>{
  if(!Array.isArray(ids)||!ids.length||ids.length>6||new Set(ids).size!==ids.length)throw Error('Invalid graph sources');
  return ids.map(id=>{nonEmptyString(id,'source',200);const s=sourceMap.get(id);if(!s)throw Error('Graph source was not supplied');return {id,type:s.type,basis:basis(s.type)};});
 };
 for(const t of delta.topics){
  exactObject(t,['ref','conceptId','label','definition','sourceIds']);
  if(typeof t.ref!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(t.ref)||refs.has(t.ref))throw Error('Invalid or duplicate topic reference');
  nonEmptyString(t.label,'label',80);nonEmptyString(t.definition,'definition',240);
  if(!t.label.trim()||!t.definition.trim()||typeof t.conceptId!=='string'||t.conceptId.length>120)throw Error('Invalid concept');
  const observed=resolveSources(t.sourceIds);
  let concept;
  if(t.conceptId){
   if(!context.candidates.some(c=>c.id===t.conceptId))throw Error('Concept was not supplied for matching');
   concept=next.concepts.find(c=>c.id===t.conceptId&&c.scope===context.scope);
   if(!concept)throw Error('Concept scope changed');
  }else concept=next.concepts.find(c=>c.scope===context.scope&&key(c.label)===key(t.label)&&key(c.definition)===key(t.definition));
  if(!concept){concept={id:`urn:uuid:${crypto.randomUUID()}`,scope:context.scope,label:t.label.trim(),definition:t.definition.trim(),status:'provisional',createdAt:context.createdAt};next.concepts.push(concept);}
  refs.set(t.ref,concept.id);
  // One encounter per concept/checkpoint, even if two aliases were returned.
  const encounter=next.encounters.find(e=>e.checkpointId===context.checkpointId&&e.conceptId===concept.id);
  if(encounter){for(const s of observed)if(!encounter.sources.some(old=>old.id===s.id))encounter.sources.push(s);}
  else next.encounters.push({conceptId:concept.id,checkpointId:context.checkpointId,sessionID:context.sessionID,createdAt:context.createdAt,sources:observed});
 }
 for(const r of delta.relationships){
  exactObject(r,['subject','predicate','object','sourceIds']);
  const subject=refs.get(r.subject),target=refs.get(r.object);
  if(!subject||!target||subject===target||!['skos:broader','skos:related','lh:usedTogetherIn'].includes(r.predicate))throw Error('Invalid graph relationship');
  const observed=resolveSources(r.sourceIds);
  const [from,to]=r.predicate==='skos:broader'?[subject,target]:[subject,target].sort();
  const existing=next.relationships.find(e=>e.subject===from&&e.object===to&&e.predicate===r.predicate);
  const support={checkpointId:context.checkpointId,sources:observed};
  if(existing){if(!existing.support.some(e=>e.checkpointId===context.checkpointId))existing.support.push(support);}
  else next.relationships.push({subject:from,predicate:r.predicate,object:to,status:'proposed',support:[support]});
 }
 const parents=new Map();
 for(const e of next.relationships.filter(e=>e.predicate==='skos:broader'))parents.set(e.subject,[...(parents.get(e.subject)??[]),e.object]);
 const reaches=(from,to)=>{
  const pending=[...(parents.get(from)??[])],seen=new Set();
  while(pending.length){const id=pending.pop();if(id===to)return true;if(seen.has(id))continue;seen.add(id);pending.push(...(parents.get(id)??[]));}return false;
 };
 for(const id of parents.keys())if(reaches(id,id))throw Error('Hierarchy cycle');
 for(const e of next.relationships)if(e.predicate==='skos:related'&&(reaches(e.subject,e.object)||reaches(e.object,e.subject)))throw Error('Related concepts cannot be hierarchical ancestors');
 // Fail visibly at capacity rather than silently pruning personal history.
 if(next.concepts.length>2000||next.relationships.length>4000||next.encounters.length>12000||next.checkpoints.length>=12000)throw Error('Work graph capacity reached');
 next.checkpoints.push(context.checkpointId);
 return next;
}
