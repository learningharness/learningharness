import {uiResource} from './ui-resource.mjs';
import {desktopLaunch} from './desktop-launch.mjs';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,openSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
export const startupUri=uiResource(process.env.LEARNING_HARNESS_HOST??'codex','startup');
export const startupSignal='LearningHarness has a startup invitation for this chat. Call the show_startup_invitation launcher tool once to display its Open and Dismiss controls. This is a UI-only control; continue the coding task independently. Do not open or expand Learn, enable learning, or repeat the invitation automatically.';
const file=(dir,id)=>{if(!validSessionId(id))throw Error('Exact chat identity required');return join(dir,'startup-'+id+'.json');};
function record(dir,id){try{return JSON.parse(readFileSync(file(dir,id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function claimStartup(dir,event,{launch=desktopLaunch()}={}){
 if(event.agent_id||!validSessionId(event.session_id)||!(['SessionStart','UserPromptSubmit'].includes(event.hook_event_name)))return null;
 if(event.hook_event_name==='SessionStart'&&!['startup','resume'].includes(event.source))return null;
 const mode=JSON.parse(readFileSync(join(dir,'state.json'),'utf8'));if(typeof mode.on!=='boolean')return null;
 const previous=record(dir,event.session_id);
 if(previous?.status==='dismissed')return null;
 if(previous&&(!launch||previous.launchId===launch.id||!previous.launchId&&previous.createdAt>=launch.startedAt))return null;
 const nonce=randomUUID(),target=file(dir,event.session_id);
 // An exclusive epoch claim prevents concurrent startup/first-prompt hooks
 // issuing the same status. The canonical record is replaced atomically.
 const epoch=launch?.id??'first';
 if(!/^(?:[a-f0-9]{64}|first)$/.test(epoch))throw Error('Invalid desktop launch');
 let fd;try{fd=openSync(target+'.'+epoch+'.claim','wx',0o600);}catch(e){if(e.code==='EEXIST')return null;throw e;}
 closeSync(fd);
 const temp=target+'.'+nonce+'.tmp';
 writeFileSync(temp,JSON.stringify({version:2,status:mode.on?'notified':'pending',kind:mode.on?'text':'card',createdAt:Date.now(),launchId:launch?.id??null,nonce}),{mode:0o600});renameSync(temp,target);
 if(mode.on)return {systemMessage:'LearningHarness is On for your Codex chats. Open LearningHarness whenever you want to learn alongside your work.'};
 return {hookSpecificOutput:{hookEventName:event.hook_event_name,additionalContext:startupSignal}};
}
export function markStartupShown(dir,id){
 const entry=record(dir,id);
 if(!entry||entry.status==='dismissed'||entry.kind==='text'||entry.shownAt)return false;
 const target=file(dir,id),temp=target+'.'+process.pid+'.tmp';
 writeFileSync(temp,JSON.stringify({...entry,shownAt:Date.now()}),{mode:0o600});renameSync(temp,target);return true;
}
export function claimStartupView(dir,id){
 const state=readStartup(dir,id),entry=record(dir,id);
 if(state.dismissed||state.on||entry.kind==='text')return {...state,dismissed:true};
 const nonce=/^[a-f0-9-]{36}$/i.test(entry.nonce??'')?entry.nonce:'legacy';
 let fd;try{fd=openSync(file(dir,id)+'.'+nonce+'.view','wx',0o600);}catch(e){if(e.code==='EEXIST')return {...state,dismissed:true};throw e;}
 closeSync(fd);return state;
}
export function readStartup(dir,id){
 const entry=record(dir,id);if(!entry)throw Error('No startup invitation for this chat');
 const mode=JSON.parse(readFileSync(join(dir,'state.json'),'utf8'));if(typeof mode.on!=='boolean')throw Error('Learning mode is unavailable');
 return {on:mode.on,dismissed:entry.status==='dismissed'};
}
export function dismissStartup(dir,id){
 const target=file(dir,id),entry=record(dir,id);if(!entry)throw Error('No startup invitation for this chat');
 const temp=target+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify({...entry,status:'dismissed'}),{mode:0o600});renameSync(temp,target);return {dismissed:true};
}
