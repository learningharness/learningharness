import {createStore} from '../desktop-runtime/state.mjs';
import {mkdir,open,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
async function claim(directory,id,kind){
 if(!validSessionId(id))throw Error('Exact chat identity required');
 await mkdir(directory,{recursive:true,mode:0o700});
 const info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Unsafe launcher directory');
 const path=join(directory,'launcher-'+id+'.'+kind);let file;
 try{file=await open(path,'wx',0o600);}catch(e){if(e.code==='EEXIST')return false;throw e;}
 try{await file.writeFile(String(Date.now()));}finally{await file.close();}return true;
}
// Neither the request nor its tool acknowledgement implies native UI visibility.
export async function claimLauncherRequest(directory,event){
 if(event.agent_id||event.agent_type||!validSessionId(event.session_id)||!['SessionStart','UserPromptSubmit'].includes(event.hook_event_name))return false;
 return claim(directory,event.session_id,'requested');
}
export async function acknowledgeLauncher(directory,id){
 if(!validSessionId(id))throw Error('Exact chat identity required');
 const requested=await lstat(join(directory,'launcher-'+id+'.requested'));
 if(!requested.isFile()||requested.isSymbolicLink())throw Error('Unsafe launcher request');
 return claim(directory,id,'acknowledged');
}

// Recheck the authoritative preference at tool time: a queued control can outlive
// the learner turning the checkbox off. Manual open_learn bypasses this gate.
export async function acknowledgeAutomaticLauncher(directory,id){
 if(!validSessionId(id))throw Error('Exact chat identity required');
 if(createStore(directory).read().showSessionLauncher!==true)throw Error('Automatic session launcher is disabled');
 const first=await acknowledgeLauncher(directory,id);
 if(!first)throw Error('Automatic session launcher was already handled');
 return true;
}
