import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// The runtime's existing single-writer lease owns this journal. Transport recovery
// preserves completed results; it never replays an interrupted model operation.
export async function createJobJournal(directory){
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=join(directory,'jobs.json');let jobs=new Map(),tail=Promise.resolve();
 const validId=value=>typeof value==='string'&&value.length>0&&value.length<=240;
 const prune=next=>{const terminal=[...next].filter(([,job])=>job.status!=='pending');for(const [id]of terminal.slice(0,Math.max(0,terminal.length-50)))next.delete(id);};
 const save=async next=>{
  const temp=join(directory,`jobs-${process.pid}-${randomUUID()}.tmp`);
  try{await writeFile(temp,JSON.stringify({version:1,jobs:[...next.values()]}),{mode:0o600});await rename(temp,file);}
  finally{await unlink(temp).catch(()=>{});}
 };
 try{
  const stored=JSON.parse(await readFile(file,'utf8'));
  if(stored?.version!==1||!Array.isArray(stored.jobs)||stored.jobs.some(job=>!validId(job?.id)||(job.chatId!==null&&!validId(job.chatId))||!['pending','ready','error'].includes(job.status)))throw Error('Invalid job journal');
  jobs=new Map(stored.jobs.map(job=>[job.id,job]));
 }catch(error){if(error.code!=='ENOENT')throw Error('Learning operation history could not be read; existing file preserved');}
 let interrupted=false;
 for(const [id,job]of jobs)if(job.status==='pending'){jobs.set(id,{id,chatId:job.chatId,status:'error',error:'This learning operation was interrupted. Retry explicitly; it was not replayed.'});interrupted=true;}
 prune(jobs);if(interrupted)await save(jobs);
 const mutate=change=>{
  const operation=tail.then(async()=>{const next=structuredClone(jobs),result=change(next);prune(next);await save(next);jobs=next;return structuredClone(result);});
  tail=operation.catch(()=>{});return operation;
 };
 return {
  get:id=>structuredClone(jobs.get(id)),
  create:(id,chatId)=>mutate(next=>{
   if(!validId(id)||(chatId!==null&&!validId(chatId)))throw Error('Invalid learning operation identity');
   const existing=next.get(id);if(existing){if(existing.chatId!==chatId)throw Error('Learning operation identity mismatch');return existing;}
   const job={id,chatId,status:'pending'};next.set(id,job);return job;
  }),
  settle:(id,value)=>mutate(next=>{
   const job=next.get(id);if(!job)throw Error('Learning operation is unavailable');
   if(!value||!['ready','error'].includes(value.status))throw Error('Invalid learning operation status');
   if(job.status!=='pending')return job;
   const settled={id,chatId:job.chatId,status:value.status,...(value.status==='ready'?{result:structuredClone(value.result)}:{error:String(value.error??'Learning operation failed').slice(0,600)})};
   next.delete(id);next.set(id,settled);return settled;
  }),
 };
}
