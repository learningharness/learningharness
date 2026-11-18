import {projectContext,validateProjectWork} from './project-context.js';
import { deriveMemory, evidenceSummary } from './memory.js';
export const emptyProfile=()=>({goals:[],known:[],preferences:''});
export function validateProfile(value){
 if(!value||Object.keys(value).some(k=>!['goals','known','preferences'].includes(k)))throw Error('Invalid learner profile');
 const list=key=>{if(!Array.isArray(value[key])||value[key].length>12||value[key].some(s=>typeof s!=='string'||!s.trim()||s.length>200))throw Error('Use up to 12 short entries per field');return [...new Set(value[key].map(s=>s.trim()))];};
 if(typeof value.preferences!=='string'||value.preferences.length>400)throw Error('Preferences must be at most 400 characters');
 return {goals:list('goals'),known:list('known'),preferences:value.preferences.trim()};
}
const words=text=>new Set(String(text).toLowerCase().match(/[a-z0-9]{3,}/g)??[]);
// Conservative retrieval hints, not concept identities or assessment evidence.
// Keep phrases specific: "stale document" and "duplicate heading" are unrelated.
const mechanismAliases = [
 /\bcache (?:invalidation|freshness)\b|\bstale (?:results?|data|values?|responses?)\b/,
 /\bidempotenc[ey]\b|\bidempotent\b|\bduplicate requests?\b|\bretry safety\b|\bsafe retries\b/,
 /\brace conditions?\b|\bdata races?\b|\blost updates?\b|\b(?:writers?|writes?) lost (?:an? )?updates?\b/,
];
const mechanisms=text=>{const normalized=String(text).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').slice(0,4000);return mechanismAliases.map(pattern=>pattern.test(normalized));};
const canonicalEvidence=data=>(data?.evidence??[]).map(e=>({...e,skillId:`topic_${String(e.objective).normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')}`}));
export const learnerTopics=data=>Object.values(deriveMemory(canonicalEvidence(data)).topics);
export function learnerContext(data,query='',skillId=null,context={}){
 const evidence=canonicalEvidence(data), topics=learnerTopics(data);
 const matchedObjectives=new Set((data?.evidence??[]).filter(e=>skillId&&e.skillId===skillId).map(e=>e.objective));
 const terms=words(query),queryMechanisms=mechanisms(query),score=t=>[...words(t.objective)].filter(w=>terms.has(w)).length+mechanisms(t.objective).filter((match,index)=>match&&queryMechanisms[index]).length*2+(matchedObjectives.has(t.objective)?100:0);
 const relevant=topics.filter(t=>score(t)>0).sort((a,b)=>score(b)-score(a)||String(b.lastAt).localeCompare(String(a.lastAt))).slice(0,6);
 const keys=new Set(relevant.map(t=>t.skillId||t.objective));
 return {project:projectContext(data??{},context),profile:data?.profile??emptyProfile(),recentlyExplored:(data?.explorations??[]).slice(-4),topics:relevant,recent:evidence.filter(e=>keys.has(e.skillId||e.objective)).slice(-3).map(evidenceSummary),uncertainty:'Profile knowledge is self-reported, not assessed. Topic beliefs are evidence projections; retention and transfer remain unproven.'};
}

export function validateMemoryBundle(value){
 if(!value||!['learning-harness-learner','dontdumb-learner'].includes(value.format)||value.version!==1||!Array.isArray(value.evidence)||value.evidence.length>10000||JSON.stringify(value).length>5000000)throw Error('Unsupported or oversized learner export');
 const profile=validateProfile(value.profile);
 const evidence=value.evidence.map(e=>{
  if(!e||typeof e.id!=='string'||!e.id||e.id.length>240||typeof e.objective!=='string'||!e.objective.trim()||e.objective.length>200||!['correct','partial','incorrect','self_reported'].includes(e.verdict)||!Number.isFinite(Date.parse(e.createdAt)))throw Error('Invalid imported assessment evidence');
  if(e.verdict==='self_reported'&&!['remembered','missed'].includes(e.selfRating)||e.confidence!=null&&!['low','medium','high'].includes(e.confidence))throw Error('Invalid imported recall or confidence');
  return {...evidenceSummary(e),host:typeof e.host==='string'?e.host.slice(0,40):'imported',imported:true,conditions:{mode:['review','imported_review'].includes(e.conditions?.mode)?'imported_review':'imported_practice',sourceExposed:'unknown'}};
 });
 const explorations=value.explorations??[];if(!Array.isArray(explorations)||explorations.length>10000)throw Error('Invalid explored topics');
 const safeExplorations=explorations.map(e=>{if(!e||typeof e.id!=='string'||e.id.length>240||typeof e.objective!=='string'||e.objective.length>200||!Array.isArray(e.path)||e.path.length>4||e.path.some(p=>typeof p!=='string'||p.length>80)||!Number.isFinite(Date.parse(e.lastAt)))throw Error('Invalid explored topic');return {id:e.id,host:String(e.host??'imported').slice(0,40),objective:e.objective,path:e.path,lastAt:e.lastAt};});
 const reviewSnoozes=value.reviewSnoozes??{};if(!reviewSnoozes||Array.isArray(reviewSnoozes)||typeof reviewSnoozes!=='object'||Object.keys(reviewSnoozes).length>1000||Object.entries(reviewSnoozes).some(([key,until])=>!key||key.length>240||['__proto__','constructor','prototype'].includes(key)||typeof until!=='string'||!Number.isFinite(Date.parse(until))))throw Error('Invalid review snoozes');
 const workContexts=value.workContexts??[];if(!Array.isArray(workContexts)||workContexts.length>300)throw Error('Invalid project work contexts');
 return {format:'learning-harness-learner',version:1,profile,evidence,explorations:safeExplorations,reviewSnoozes,workContexts:workContexts.map(validateProjectWork)};
}
