import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {validSessionId} from '../../packages/hosts/src/native-host.js';
const file=(dir,chat,id)=>{if(!validSessionId(chat)||!validSessionId(id))throw Error('Exact invitation identity required');return join(dir,`prepared-${chat}-${id}.json`);};
export function publishPrepared(dir,chat,target){
 if(!target?.goal?.insight&&target?.kind!=='review'&&!(target?.kind==='moment'&&target.momentId&&target.title))throw Error('No prepared learning content is available');
 const id=validSessionId(target.id)?target.id:randomUUID(),value={...structuredClone(target),id,title:target.goal?.outcome??target.title};
 try{writeFileSync(file(dir,chat,id),JSON.stringify(value),{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;return readPrepared(dir,chat,id);}return value;
}
export function readPrepared(dir,chat,id){return JSON.parse(readFileSync(file(dir,chat,id),'utf8'));}
export function presentationState(dir,chat,id,patch){
 const path=file(dir,chat,id)+'.state';readPrepared(dir,chat,id);
 let state={};try{state=JSON.parse(readFileSync(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(patch){state={...state,...patch};writeFileSync(path,JSON.stringify(state),{mode:0o600});}
 return state;
}
