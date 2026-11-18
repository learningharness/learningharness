import {runtimeCall} from './runtime-client.mjs';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
export function parseDesktopArgs(args){
 const [action,...rest]=args;
 if(!['status','chats','on','off','new-moment','job'].includes(action))throw Error('Use status, chats, on, off, new-moment or job.');
 const options={};
 for(let i=0;i<rest.length;i+=2){const flag=rest[i],value=rest[i+1];if(!['--chat','--job'].includes(flag)||!value||options[flag])throw Error('Invalid shortcut arguments.');options[flag]=value;}
 const id=options['--chat'];if(id&&!validSessionId(id))throw Error('Invalid chat identity.');
 if(['new-moment','job'].includes(action)&&!id)throw Error('Choose a coding chat first.');
 if(action==='job'&&!validSessionId(options['--job']))throw Error('Invalid learning job.');
 if(action!=='job'&&options['--job'])throw Error('Unexpected job argument.');
 if(['chats','status'].includes(action)&&id)throw Error('Unexpected chat argument.');
 return action==='status'||action==='chats'?{method:'desktop-'+action,params:{}}:action==='job'?{method:'desktop-job',params:{id,job:options['--job']}}:{method:'desktop-action',params:{action,...(id?{id}:{})}};
}
export async function main(args,call=runtimeCall){try{const {method,params}=parseDesktopArgs(args);return await call(method,params);}catch(error){return {error:String(error.message).slice(0,400)};}}
