import {validateProjectWork} from './project-context.js';
import { mkdir, readFile, writeFile, rename, unlink, symlink, readlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { emptyProfile, validateProfile, validateMemoryBundle } from './learner-context.js';
import { evidenceSummary } from './memory.js';
const busy = () => Error('Learner memory is busy. Retry shortly; no data was overwritten.');
const wait = () => new Promise(resolve => setTimeout(resolve, 20));
function alive(pid) {
 try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
// Atomic symlinks carry ownership from creation: no empty-file crash gap.
// Bakery tickets serialize recovery too, so two reapers cannot unlink a new owner.
// Unique contender paths are never reused; dead contenders can be removed safely.
async function acquireLearnerLock(directory) {
 const id = `${process.pid}-${crypto.randomUUID()}`, prefix = '.learner-writer-';
 const contender = join(directory, prefix + id), lock = join(directory, 'learner.lock');
 const staging = contender + '.ticket';
 const peers = async () => {
  const result = [];
  for (const name of await readdir(directory)) {
   const match = /^\.learner-writer-(\d+)-([0-9a-f-]{36})$/.exec(name);
   if (!match) continue;
   if (!alive(Number(match[1]))) { await unlink(join(directory, name)).catch(() => {}); continue; }
   try { result.push({ id: name.slice(prefix.length), ticket: await readlink(join(directory, name)) }); }
   catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return result;
 };
 await symlink('choosing', contender);
 let owned = false;
 try {
  const ticket = 1 + Math.max(0, ...(await peers()).map(peer => Number(peer.ticket) || 0));
  await symlink(String(ticket), staging); await rename(staging, contender);
  for (let attempt = 0; attempt < 30; attempt++) {
   const blocked = (await peers()).some(peer => peer.id !== id && (peer.ticket === 'choosing' || Number(peer.ticket) < ticket || Number(peer.ticket) === ticket && peer.id < id));
   if (blocked) { await wait(); continue; }
   try { await symlink(`learningharness:${process.pid}:${id}`, lock); owned = true; break; }
   catch (error) { if (error.code !== 'EEXIST') throw error; }
   let owner;
   try { owner = await readlink(lock); }
   catch (error) {
    if (error.code === 'ENOENT') continue;
    if (error.code === 'EINVAL') throw Error('Learner memory has a legacy or unknown lock. Stop all learning hosts, then remove learner.lock from the learner data directory and retry. Existing memory was preserved.');
    throw error;
   }
   const match = /^learningharness:(\d+):.+$/.exec(owner);
   if (!match) throw Error('Learner memory has an unknown lock; stop all learning hosts before removing learner.lock. Existing memory was preserved.');
   if (!alive(Number(match[1]))) { await unlink(lock); continue; }
   await wait();
  }
  if (!owned) throw busy();
  return async () => { try { await unlink(lock); } finally { await unlink(contender); } };
 } catch (error) {
  await unlink(contender).catch(() => {}); throw error;
 } finally { await unlink(staging).catch(() => {}); }
}
// Shared local learner data, separate from each host's session/UI state.
// Each mutation re-reads under an exclusive lock, so simultaneous hosts merge.
export function learnerStore(directory){
 const file=join(directory,'learner.json');
 const read=async()=>{try{const s=JSON.parse(await readFile(file,'utf8'));if(s.version!==1||!Array.isArray(s.evidence))throw Error('Unsupported learner memory');validateProfile(s.profile);s.explorations??=[];s.reviewSnoozes??={};s.workContexts??=[];return s;}catch(e){if(e.code==='ENOENT')return {version:1,profile:emptyProfile(),evidence:[],explorations:[],reviewSnoozes:{},workContexts:[]};throw Error('Learner memory could not be read; existing file preserved');}};
 const mutate=async change=>{
  await mkdir(directory,{recursive:true,mode:0o700});
  const release = await acquireLearnerLock(directory);
  const temp=join(directory,`learner-${process.pid}-${crypto.randomUUID()}.tmp`);
  try{const state=await read();change(state);await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,file);return state;}
  finally{await unlink(temp).catch(()=>{});await release();}
 };
 return {read,export:async()=>{const s=await read();return {format:'learning-harness-learner',version:1,exportedAt:new Date().toISOString(),profile:s.profile,evidence:s.evidence,explorations:s.explorations,reviewSnoozes:s.reviewSnoozes??{},workContexts:s.workContexts??[]};},
 // Internal same-device migration. External imports still use the conservative
 // import validator below; local provenance must survive a directory rename.
 mergeLocalState:input=>{if(input?.version!==1||!Array.isArray(input.evidence)||!Array.isArray(input.explorations??[])||input.evidence.some(e=>typeof e?.id!=='string'))throw Error('Invalid local learner state');const profile=validateProfile(input.profile);return mutate(s=>{for(const field of ['evidence','explorations']){s[field]??=[];const ids=new Set(s[field].map(e=>e.id));for(const item of input[field]??[])if(!ids.has(item.id)){s[field].push(structuredClone(item));ids.add(item.id);}}s.workContexts??=[];const workIds=new Set(s.workContexts.map(w=>w.id));for(const w of (input.workContexts??[]).map(validateProjectWork))if(!workIds.has(w.id)){s.workContexts.push(w);workIds.add(w.id);}s.workContexts=s.workContexts.slice(-300);if(!s.profile.goals.length&&!s.profile.known.length&&!s.profile.preferences){s.profile=profile;if(input.profileUpdatedAt)s.profileUpdatedAt=input.profileUpdatedAt;}s.reviewSnoozes??={};for(const [key,until]of Object.entries(input.reviewSnoozes??{}))if(!['__proto__','constructor','prototype'].includes(key)&&Number.isFinite(Date.parse(until))&&(!s.reviewSnoozes[key]||Date.parse(until)>Date.parse(s.reviewSnoozes[key])))s.reviewSnoozes[key]=until;});},
 import:input=>{const safe=validateMemoryBundle(input);return mutate(s=>{s.reviewSnoozes??={};for(const [key,until] of Object.entries(safe.reviewSnoozes??{}))if(!s.reviewSnoozes[key]||Date.parse(until)>Date.parse(s.reviewSnoozes[key]))s.reviewSnoozes[key]=until;s.reviewSnoozes=Object.fromEntries(Object.entries(s.reviewSnoozes).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])).slice(0,1000));s.workContexts??=[];const workIds=new Set(s.workContexts.map(w=>w.id));for(const w of safe.workContexts)if(!workIds.has(w.id)){s.workContexts.push(w);workIds.add(w.id);}s.workContexts=s.workContexts.slice(-300);const ids=new Set(s.evidence.map(e=>e.id));for(const e of safe.evidence)if(!ids.has(e.id)){s.evidence.push(e);ids.add(e.id);}const explored=new Set(s.explorations.map(e=>e.id));for(const e of safe.explorations)if(!explored.has(e.id)){s.explorations.push(e);explored.add(e.id);}if(!s.profile.goals.length&&!s.profile.known.length&&!s.profile.preferences)s.profile=safe.profile;});},
 snoozeReview:(key,until)=>mutate(s=>{if(typeof key!=='string'||!key||key.length>240||['__proto__','constructor','prototype'].includes(key)||typeof until!=='string'||!Number.isFinite(Date.parse(until)))throw Error('Invalid review snooze');s.reviewSnoozes??={};s.reviewSnoozes[key]=until;s.reviewSnoozes=Object.fromEntries(Object.entries(s.reviewSnoozes).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])).slice(0,1000));}),
 noteProjectWork:(host,input)=>{const item=validateProjectWork({...input,id:`${host}:${input.sessionId}:${input.taskId}`});return mutate(s=>{s.workContexts??=[];if(!s.workContexts.some(w=>w.id===item.id))s.workContexts.push(item);s.workContexts=s.workContexts.slice(-300);});},
 noteExploration:(host,topic)=>mutate(s=>{const entry=s.explorations.find(e=>e.host===host&&e.objective===topic.objective);if(entry)entry.lastAt=new Date().toISOString();else s.explorations.push({id:crypto.randomUUID(),host,objective:String(topic.objective).slice(0,200),path:(topic.path??[]).slice(0,4),lastAt:new Date().toISOString()});}),
 saveProfile:profile=>{const safe=validateProfile(profile);return mutate(s=>{s.profile=safe;s.profileUpdatedAt=new Date().toISOString();});},mergeEvidence:(host,items)=>mutate(s=>{
  const ids=new Set(s.evidence.map(e=>e.id));for(const item of items){if(!item.id&&!item.momentId)continue;const id=`${host}:${item.id??item.momentId}`;if(ids.has(id))continue;ids.add(id);s.evidence.push({...evidenceSummary(item),id,host,taskFingerprint:item.taskFingerprint});}
 })};
}
