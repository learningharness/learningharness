import {readFileSync,writeFileSync,renameSync,mkdirSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
// Separate from prepared content: a replacement topic must not reset pacing.
export function opportunityBackoff(directory,id,event,chain,{deliver=false,now=Date.now()}={}){
 const path=join(directory,'opportunity-pacing-'+id+'.json'),lock=path+'.lock';
 try{mkdirSync(lock);}catch(error){if(error.code==='EEXIST'){try{if(now-statSync(lock).mtimeMs>60000)rmSync(lock,{recursive:true,force:true});}catch{}return false;}throw error;}
 try{
 let state={turn:0,offers:0,nextTurn:0,engagedAt:0};
 try{state={...state,...JSON.parse(readFileSync(path,'utf8'))};}catch(error){if(error.code!=='ENOENT')return false;}
 if(event.hook_event_name==='UserPromptSubmit')state.turn++;
 if(chain?.openedAt>state.engagedAt){state.engagedAt=chain.openedAt;state.offers=0;state.nextTurn=state.turn;}
 const eligible=state.turn>=state.nextTurn;
 if(deliver&&eligible){state.offers++;state.nextTurn=state.turn+state.offers+1;state.lastSignalAt=now;}
 const tmp=path+'.'+process.pid+'.tmp';writeFileSync(tmp,JSON.stringify(state),{mode:0o600});renameSync(tmp,path);
 return eligible;
 }finally{rmSync(lock,{recursive:true,force:true});}
}
