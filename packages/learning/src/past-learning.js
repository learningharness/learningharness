import {conceptKey} from './review-ledger.js';
// Historical learning is independent of the coding chat currently hosting it.
export function learningOrigin(state,item){
 const context=item.learningContext??state.sessions?.[item.sessionID]?.context??{};
 return {sessionID:context.sessionID??item.sessionID,...Object.fromEntries(['project','projectKey','title'].filter(key=>typeof context[key]==='string').map(key=>[key,context[key]]))};
}
// Read only the teaching that was actually opened or archived. Prefetched lessons
// and ungenerated journey plans are not learner history.
export function savedLearning(state,{currentSessionID,groupRevisits=true}={}){
 const currentID=currentSessionID&&state.sessions?.[currentSessionID]?.moment?.id;
 const records=new Map();
 const add=(item,savedFrom)=>{
  if(!item?.id||item.id===currentID)return;
  const identity=groupRevisits?(item.revisitedOf??item.id):item.id,existing=records.get(identity);
  // Rereading creates a separate attempt, not another library item. Prefer
  // the original teaching even when a newer archived copy was encountered first.
  if(existing&&(!existing.revisitedOf||item.revisitedOf))return;
  records.set(identity,{...item,learningContext:learningOrigin(state,item),savedFrom,recordKind:item.lesson?'lesson':'learning-note',canRevisit:true});
 };
 for(const item of state.history??[])add(item,'archive');
 for(const [sessionID,session] of Object.entries(state.sessions??{})){
  if(sessionID===currentSessionID||!session.moment)continue;
  add({...session.moment,sessionID,feedback:session.feedback,help:session.askAnswer,hint:session.hint,draft:session.draft},'session');
 }
 for(const journey of Object.values(state.journeys??{})){
  for(const stage of Object.values(journey.stages??{})){
   if(!stage.moment)continue;
   add({...stage.moment,sessionID:journey.origin?.sessionID??journey.ownerSessionID,learningContext:journey.origin,feedback:stage.feedback,help:stage.askAnswer,hint:stage.hint,draft:stage.draft},'journey');
  }
 }
 return [...records.values()].sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
}
export function reviewMaterial(state,topic,host){
 const available=!topic.host||topic.host===host;
 const saved=available&&topic.momentId?savedLearning(state,{groupRevisits:false}).find(item=>item.id===topic.momentId&&(!topic.objective||conceptKey(item.objective)===conceptKey(topic.objective))):null;
 return {snapshot:structuredClone(saved?.snapshot??[]),origin:saved?learningOrigin(state,saved):{...(topic.project?{project:topic.project}:{}),...(topic.projectKey?{projectKey:topic.projectKey}:{}),...(topic.sessionTitle?{title:topic.sessionTitle}:{})},sourceAvailable:Boolean(saved?.snapshot?.length)};
}
