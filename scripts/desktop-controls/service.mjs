import {randomUUID} from 'node:crypto';
import {basename} from 'node:path';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
const label=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,120);
// Private local-socket API for the optional desktop helper. No focused-chat guess.
export function createDesktopControls({engine,host,mode,jobs,ensureSession,observe}){
 return async(method,p={})=>{
  if(method==='desktop-status')return {enabled:engine.state.enabled,stopped:!!engine.state.globallyStopped};
  if(method==='desktop-chats'){
   const seen=new Set(),chats=[];
   for(const chat of await host.listThreads()){
    if(chats.length>=30)break;
    if(!validSessionId(chat.id)||seen.has(chat.id))continue;
    seen.add(chat.id);chats.push({id:chat.id,title:label(chat.name)||'Untitled chat',project:label(basename(chat.cwd??'')),paused:!!engine.state.sessions[chat.id]?.paused});
   }
   return {enabled:engine.state.enabled,chats};
  }
  if(method==='desktop-job'){
   const job=jobs.get(p.job);
   if(!validSessionId(p.id)||!job||job.chatId!==p.id)throw Error('Learning job unavailable for this chat.');
   return {status:job.status,...(job.status==='error'?{error:label(job.error)||'Open Learn to review the connection and retry.'}:{})};
  }
  if(method!=='desktop-action'||!['on','off','new-moment'].includes(p.action))throw Error('Unknown desktop learning action.');
  if(p.id!=null&&!validSessionId(p.id))throw Error('Exact chat identity required.');
  if(p.action==='on'||p.action==='off'){
   const on=p.action==='on';let result=await engine.command({action:on?'enable':'disable',...(p.id?{sessionID:p.id}:{})});
   if(on&&p.id&&result.session?.paused)result=await engine.command({action:'resume',sessionID:p.id});
   if(result.enabled!==on||(on&&p.id&&result.session?.paused))throw Error('Could not confirm learning status. Open Learn to check.');
   mode.set(on);return {enabled:on};
  }
  if(!validSessionId(p.id))throw Error('Choose the coding chat for this learning moment.');
  if(!engine.state.enabled||engine.state.globallyStopped)throw Error('Turn learning on before creating a moment.');
  if(engine.state.sessions[p.id]?.paused)throw Error('This chat is paused. Turn learning on for this chat first.');
  const key=randomUUID();await jobs.create(key,p.id);
  void(async()=>{await ensureSession(p.id);await observe(p.id);return engine.command({action:'new-moment',sessionID:p.id});})()
   .then(result=>jobs.settle(key,{status:'ready',result}))
   .catch(async error=>{await engine.fail(error,p.id);await jobs.settle(key,{status:'error',error:error.message});})
   .catch(()=>engine.record('native_operation_unavailable',p.id,{status:'error'})); // Never replay a failed job.
  return {job:key,id:p.id};
 };
}
