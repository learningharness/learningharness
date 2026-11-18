import {mkdir,open,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
const stages=new Set(['prepared','attempted','acknowledged','opened','practiced']);
const statuses=new Set(['pending','failed','prepared','silent','interrupted']);
const reasons=new Set(['generation-failed','work-changed']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const time=value=>Number.isSafeInteger(value)&&value>=0;
const cap=value=>Number.isInteger(value)&&value>=1&&value<=1000;
const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
function identity(sessionID,runtimeKey){
 if(typeof sessionID!=='string'||!sessionID||sessionID.length>240||typeof runtimeKey!=='string'||!runtimeKey||runtimeKey.length>8000)throw Error('Invalid delivery identity');
 // Runtime keys contain topic titles. Persist only opaque digests, never content.
 return {key:hash(JSON.stringify([sessionID,runtimeKey])),sessionKey:hash(sessionID)};
}
function validEntry(entry){
 if(!only(entry,['key','sessionKey','createdAt','updatedAt','timestamps','preparation','invitationIds'])||!digest(entry.key)||!digest(entry.sessionKey)||!time(entry.createdAt)||!time(entry.updatedAt)||!only(entry.timestamps,[...stages])||!Object.values(entry.timestamps).every(time))return false;
 if(entry.invitationIds!==undefined&&(!Array.isArray(entry.invitationIds)||entry.invitationIds.length>32||!entry.invitationIds.every(validSessionId)||new Set(entry.invitationIds).size!==entry.invitationIds.length))return false;
 const p=entry.preparation;
 return p===undefined||only(p,['status','attempts','maxAttempts','startedAt','settledAt','retryAt','reason','invitationId'])&&statuses.has(p.status)&&Number.isInteger(p.attempts)&&p.attempts>=0&&cap(p.maxAttempts)&&p.attempts<=p.maxAttempts&&['startedAt','settledAt','retryAt'].every(key=>p[key]===undefined||time(p[key]))&&(p.reason===undefined||reasons.has(p.reason))&&(p.invitationId===undefined||validSessionId(p.invitationId));
}
// One instance belongs to the runtime's existing writer lease. Hook/server
// processes must send updates through that runtime, not open competing writers.
export async function createDeliveryLedger(directory,{now=Date.now,maxEntries=200}={}){
 if(!cap(maxEntries))throw Error('Invalid delivery history bound');
 await mkdir(directory,{recursive:true,mode:0o700});const info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Unsafe delivery history directory');
 const file=join(directory,'delivery-ledger.json');let entries=new Map(),tail=Promise.resolve();
 const timestamp=()=>{const value=now();if(!time(value))throw Error('Invalid delivery timestamp');return value;};
 const prune=next=>{
  for(const [key,entry] of next){if(next.size<=maxEntries)break;if(entry.preparation?.status!=='pending')next.delete(key);}
  if(next.size>maxEntries)throw Error('Delivery history is busy; retry later');
 };
 const save=async next=>{
  const temporary=join(directory,`delivery-${process.pid}-${randomUUID()}.tmp`);
  try{await writeFile(temporary,JSON.stringify({version:1,entries:[...next.values()]}),{mode:0o600,flag:'wx'});await rename(temporary,file);}
  finally{await unlink(temporary).catch(()=>{});}
 };
 try{
  const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);let stored;
  try{const stat=await fd.stat();if(!stat.isFile()||stat.size>2_000_000)throw Error('Invalid delivery history');stored=JSON.parse(await fd.readFile('utf8'));}finally{await fd.close();}
  if(!only(stored,['version','entries'])||stored.version!==1||!Array.isArray(stored.entries)||stored.entries.length>1000||!stored.entries.every(validEntry))throw Error('Invalid delivery history');
  entries=new Map(stored.entries.map(entry=>[entry.key,entry]));if(entries.size!==stored.entries.length)throw Error('Duplicate delivery history');
 }catch(error){if(error.code!=='ENOENT')throw Error('Delivery history could not be read; existing file preserved');}
 let recovered=false;
 for(const entry of entries.values())if(entry.preparation?.status==='pending'){entry.preparation={...entry.preparation,status:'interrupted',settledAt:timestamp()};entry.updatedAt=timestamp();recovered=true;}
 const priorSize=entries.size;prune(entries);if(recovered||entries.size!==priorSize)await save(entries);
 const mutate=change=>{
  const operation=tail.then(async()=>{const next=structuredClone(entries),result=change(next);prune(next);await save(next);entries=next;return structuredClone(result);});tail=operation.catch(()=>{});return operation;
 };
 const entryFor=(next,id,key)=>{const identityKey=identity(id,key);let entry=next.get(identityKey.key);if(!entry){if(next.size>=maxEntries&&[...next.values()].every(entry=>entry.preparation?.status==='pending'))throw Error('Delivery history is busy; retry later');const at=timestamp();entry={...identityKey,createdAt:at,updatedAt:at,timestamps:{}};next.set(entry.key,entry);}return entry;};
 const findInvitation=(next,id,invitationId)=>{
  if(!validSessionId(invitationId))throw Error('Invalid invitation identity');
  const sessionKey=identity(id,'scope').sessionKey;return [...next.values()].find(entry=>entry.sessionKey===sessionKey&&entry.invitationIds?.includes(invitationId));
 };
 const recordStage=(entry,stage)=>{if(!stages.has(stage))throw Error('Invalid delivery stage');if(entry.timestamps[stage]===undefined){entry.timestamps[stage]=timestamp();entry.updatedAt=timestamp();}return entry;};
 const bindInvitation=(next,entry,invitationId)=>{
  if(!validSessionId(invitationId))throw Error('Invalid invitation identity');
  const bound=[...next.values()].find(other=>other.sessionKey===entry.sessionKey&&other.invitationIds?.includes(invitationId));
  if(bound&&bound.key!==entry.key)throw Error('Invitation is bound to another delivery identity');
  entry.invitationIds=[...new Set([...(entry.invitationIds??[]),invitationId])].slice(-32);
 };
 return {
  get:(id,key)=>structuredClone(entries.get(identity(id,key).key)),
  list:id=>{const sessionKey=id===undefined?null:identity(id,'scope').sessionKey;return structuredClone([...entries.values()].filter(entry=>!sessionKey||entry.sessionKey===sessionKey));},
  findInvitation:(id,invitationId)=>structuredClone(findInvitation(entries,id,invitationId)),
  recordInvitation:(id,invitationId,stage)=>mutate(next=>{
   const entry=findInvitation(next,id,invitationId);if(!entry)throw Error('Delivery invitation is unavailable');return recordStage(entry,stage);
  }),
  record:(id,key,stage,metadata={})=>mutate(next=>{
   if(!stages.has(stage))throw Error('Invalid delivery stage');
   if(!only(metadata,stage==='prepared'?['invitationId']:[]))throw Error('Invalid delivery metadata');
   const entry=entryFor(next,id,key);
   if(metadata.invitationId!==undefined){
    bindInvitation(next,entry,metadata.invitationId);
    // The publisher may have recovered exact, validated engine cache after a
    // crash. Recording that fact settles only its matching reservation.
    if(entry.preparation?.invitationId===metadata.invitationId&&['pending','interrupted'].includes(entry.preparation.status))entry.preparation={...entry.preparation,status:'prepared',settledAt:timestamp()};
   }
   return recordStage(entry,stage);
  }),
  beginPreparation:(id,key,{maxAttempts=3,allowInterruptedRetry=false,invitationId}={})=>mutate(next=>{
   if(!cap(maxAttempts)||typeof allowInterruptedRetry!=='boolean')throw Error('Invalid preparation policy');
   if(invitationId!==undefined&&!validSessionId(invitationId))throw Error('Invalid invitation identity');
   const entry=entryFor(next,id,key),p=entry.preparation,limit=Math.min(p?.maxAttempts??maxAttempts,maxAttempts);
   if(p?.status==='pending'||p?.status==='silent'||p?.status==='prepared'||!p&&entry.timestamps.prepared!==undefined||p?.status==='interrupted'&&!allowInterruptedRetry||(p?.attempts??0)>=limit||timestamp()<(p?.retryAt??0))return null;
   entry.preparation={status:'pending',attempts:(p?.attempts??0)+1,maxAttempts:limit,startedAt:timestamp(),...(invitationId?{invitationId}:{})};entry.updatedAt=timestamp();return entry.preparation;
  }),
  finishPreparation:(id,key,{attempt,status}={})=>mutate(next=>{
   if(!['prepared','silent','interrupted'].includes(status))throw Error('Invalid preparation outcome');
   const entry=next.get(identity(id,key).key),p=entry?.preparation;if(!p||p.status!=='pending'||p.attempts!==attempt)return entry;
   entry.preparation={...p,status,settledAt:timestamp()};entry.updatedAt=timestamp();if(status==='prepared'){entry.timestamps.prepared??=timestamp();if(p.invitationId)bindInvitation(next,entry,p.invitationId);}return entry;
  }),
  failPreparation:(id,key,{attempt,retryAt,reason}={})=>mutate(next=>{
   if(!time(retryAt)||!reasons.has(reason))throw Error('Invalid preparation retry');
   const entry=next.get(identity(id,key).key),p=entry?.preparation;if(!p||p.status!=='pending'||p.attempts!==attempt)return entry;
   entry.preparation={...p,status:'failed',settledAt:timestamp(),retryAt,reason};entry.updatedAt=timestamp();return entry;
  }),
  invalidatePreparation:(id,key,{retryAt,maxAttempts=3}={})=>mutate(next=>{
   if(!time(retryAt)||!cap(maxAttempts))throw Error('Invalid preparation retry');
   const entry=entryFor(next,id,key),p=entry.preparation;
   if(p?.status==='pending'||p?.status==='interrupted')return entry;
   entry.preparation={status:'failed',attempts:p?.attempts??0,maxAttempts:Math.min(p?.maxAttempts??maxAttempts,maxAttempts),settledAt:timestamp(),retryAt,reason:'work-changed'};entry.updatedAt=timestamp();return entry;
  }),
 };
}
