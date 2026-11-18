import {randomUUID} from 'node:crypto';
function invitationTarget(session,key,id=randomUUID()){
 const packet=session.upcomingGoals??session.goals;
 return key.startsWith('moment:')?{id,kind:'moment',momentId:session.moment.id,title:session.moment.title}:packet?.list?.[0]?.insight?{id,kind:'goal',goal:structuredClone(packet.list[0]),snapshot:structuredClone(packet.snapshot??[])}:null;
}
export function createInvitationPublisher({getEngine,readChain,writeChain,projectRuntimeInvitation,now=Date.now,retryMs=30000,workRetryMs=1000,maxAttempts=3,intentGraceMs=0,settleMs=0,deliveryLedger=null,retryInterruptedPreparation=null}){
 const preparing=new Map(), retries=new Map(),waiting=new Map();
return function syncInvitation(id){
 const engine=getEngine();
 if(!engine?.state.enabled||engine.state.globallyStopped||!engine.state.sessions[id])return;
 const old=readChain(id);if(old?.runtime&&old.status==='ready'&&!old.preparedTarget)writeChain(id,{...old,status:'stale',runtimeKey:null,readyAt:0});
 // Due review cards are deterministic reminders. Only an explicit learner
 // action may generate review teaching; retire legacy automatic review links.
 if(old?.status==='ready'&&old.preparedTarget?.kind==='review')writeChain(id,{...old,status:'stale',runtimeKey:null,readyAt:0});
 if(old?.status==='ready'&&old.preparedTarget?.kind==='goal'&&engine.preparedOpportunityCurrent&&!engine.preparedOpportunityCurrent(id,old.preparedTarget)){
  writeChain(id,{...old,status:'stale',runtimeKey:null,readyAt:0});preparing.delete(id);
  const prior=retries.get(id);retries.set(id,{key:old.runtimeKey,at:now()+retryMs,attempts:prior?.key===old.runtimeKey?prior.attempts:0});
  return deliveryLedger?.invalidatePreparation(id,old.runtimeKey,{retryAt:now()+retryMs,maxAttempts}).catch(()=>engine.record('native_delivery_failed',id,{status:'unavailable'}));
 }
 // A persisted prepared chain can outlive the publisher. Import its binding
 // without generating again, and without asserting delivery or visibility.
 const oldDelivery=deliveryLedger&&old?.runtimeKey?deliveryLedger.get(id,old.runtimeKey):null;
 const restored=deliveryLedger&&old?.status==='ready'&&old.runtimeKey&&old.preparedTarget&&old.preparedTarget.kind!=='review'&&!(oldDelivery?.timestamps.prepared!==undefined&&oldDelivery?.invitationIds?.includes(old.preparedTarget.id))
  ?deliveryLedger.record(id,old.runtimeKey,'prepared',{invitationId:old.preparedTarget.id}).catch(()=>engine.record('native_delivery_failed',id,{status:'unavailable'})):null;
 const next=projectRuntimeInvitation(engine.session(id),readChain(id));
 if(!next)return restored;
 if(next.status!=='ready'){writeChain(id,next);return;}
 if(preparing.get(id)===next.runtimeKey)return;
 const retry=retries.get(id);if(retry?.key===next.runtimeKey&&(now()<retry.at||retry.attempts>=maxAttempts))return;
 const durable=deliveryLedger?.get(id,next.runtimeKey)?.preparation,session=engine.session(id);
 if(!next.runtimeKey.startsWith('moment:')&&!(session.upcomingGoals??session.goals)?.list?.[0]?.insight)return restored;
 // A crash may happen after the engine persisted content but before the chain
 // was published. Reconstruct only the exact reservation, with current cache
 // validation. This path never invokes prepareOpportunity or a model.
 const cachedID=durable?.invitationId,cached=cachedID&&session.preparedLessons?.[cachedID];
 if(cached?.moment?.invitationId===cachedID&&['pending','interrupted','prepared'].includes(durable?.status)){
  const target=invitationTarget(session,next.runtimeKey,cachedID);
  if(target&&engine.preparedOpportunityCurrent?.(id,target)===true){
   preparing.set(id,next.runtimeKey);
   return deliveryLedger.record(id,next.runtimeKey,'prepared',{invitationId:cachedID}).then(()=>{
    const current=projectRuntimeInvitation(engine.session(id),readChain(id));
    if(engine.state.enabled&&!engine.state.globallyStopped&&!engine.session(id).paused&&current?.runtimeKey===next.runtimeKey&&engine.preparedOpportunityCurrent(id,target))writeChain(id,{...next,readyAt:now(),preparedTarget:target});
   }).catch(()=>engine.record('native_delivery_failed',id,{status:'unavailable'})).finally(()=>{if(preparing.get(id)===next.runtimeKey)preparing.delete(id);});
  }
 }
 // Only an explicit caller-supplied safe retry policy can authorize replay of
 // an interrupted paid operation. A normal restart never grants that consent.
 const allowInterruptedRetry=durable?.status==='interrupted'&&typeof retryInterruptedPreparation==='function'&&retryInterruptedPreparation(structuredClone(durable))===true;
 if(durable&&(durable.status==='pending'||['prepared','silent'].includes(durable.status)||durable.status==='interrupted'&&!allowInterruptedRetry||durable.attempts>=Math.min(durable.maxAttempts,maxAttempts)||now()<(durable.retryAt??0)))return;
 preparing.set(id,next.runtimeKey);
 if(!next.runtimeKey.startsWith('moment:')&&(intentGraceMs||settleMs)){
  const sequence=session.workSelection?.sequence??0;
  let wait=waiting.get(id);
  if(wait?.key!==next.runtimeKey){wait={key:next.runtimeKey,at:now(),changedAt:now(),sequence};waiting.set(id,wait);}
  if(wait.sequence!==sequence){wait.sequence=sequence;wait.changedAt=now();}
  const code=session.trace?.some(event=>event.type==='file.changed'||event.type==='tool.succeeded'&&event.data?.path&&event.data?.content);
  if(now()-wait.changedAt<settleMs||!code&&now()-wait.at<intentGraceMs){preparing.delete(id);return;}
 }

 const target=invitationTarget(session,next.runtimeKey);
 if(!target){preparing.delete(id);return;}
 let attempts=retry?.key===next.runtimeKey?retry.attempts+1:1;
 let preparationCompleted=false;
 const stopped=()=>!engine.state.enabled||engine.state.globallyStopped||engine.session(id).paused;
 const interrupt=async()=>{if(preparing.get(id)===next.runtimeKey)preparing.delete(id);await deliveryLedger?.finishPreparation(id,next.runtimeKey,{attempt:attempts,status:'interrupted'});};
 return (async()=>{
  try{
   if(deliveryLedger){const reservation=await deliveryLedger.beginPreparation(id,next.runtimeKey,{maxAttempts,allowInterruptedRetry,invitationId:target.id});if(!reservation){preparing.delete(id);return;}attempts=reservation.attempts;}
   if(stopped()){await interrupt();return;}
   const prepared=await engine.prepareOpportunity(id,target);
   preparationCompleted=true;
   if(stopped()){await interrupt();return;}
   if(prepared!==false&&engine.preparedOpportunityCurrent&&!engine.preparedOpportunityCurrent(id,target))throw Object.assign(Error('Prepared work became stale'),{code:'LEARNING_WORK_CHANGED'});
   await deliveryLedger?.finishPreparation(id,next.runtimeKey,{attempt:attempts,status:prepared===false?'silent':'prepared'});
   const current=projectRuntimeInvitation(engine.session(id),readChain(id));
   if(current?.runtimeKey===next.runtimeKey){if(prepared===false){writeChain(id,{...next,status:'silent',readyAt:0});preparing.delete(id);return;}writeChain(id,{...next,readyAt:now(),preparedTarget:target});}
  }catch(error){
   const changed=error.code==='LEARNING_WORK_CHANGED',retryAt=now()+(changed?workRetryMs:retryMs);
   if(preparing.get(id)===next.runtimeKey){preparing.delete(id);retries.set(id,{key:next.runtimeKey,at:retryAt,attempts});}
   try{if(preparationCompleted&&!changed)await interrupt();else await deliveryLedger?.failPreparation(id,next.runtimeKey,{attempt:attempts,retryAt,reason:changed?'work-changed':'generation-failed'});}catch{engine.record('native_delivery_failed',id,{status:'unavailable'});}
   engine.record('native_preparation_failed',id,{status:attempts>=maxAttempts?'exhausted':'retrying',reason:changed?'work-changed':'generation-failed'});
  }
 })();
}
}
