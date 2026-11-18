import {connect} from 'node:net';import {spawn} from 'node:child_process';import {join} from 'node:path';import {chainDirectory} from './chain.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {compatibleRuntime} from './runtime-compatibility.mjs';
const build=createHash('sha256').update(readFileSync(new URL('./runtime-service.mjs',import.meta.url))).digest('hex');
export const socketPath=join(chainDirectory,'core.sock');
function once(method,params){return new Promise((resolve,reject)=>{const socket=connect(socketPath);let text='';const timer=setTimeout(()=>socket.destroy(Error('Learning runtime did not respond')),8000);socket.on('connect',()=>socket.end(JSON.stringify({method,params})+'\n'));socket.on('data',chunk=>text+=chunk);socket.on('end',()=>{clearTimeout(timer);try{const r=JSON.parse(text);r.error?reject(Error(r.error)):resolve(r.result);}catch(e){reject(e);}});socket.on('error',e=>{clearTimeout(timer);reject(e);});});}
let starting;
async function rawRuntimeCall(method,params={}){try{return await once(method,params);}catch(e){if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}
 if(!starting)starting=(async()=>{const p=spawn(process.execPath,[new URL('./runtime-service.mjs',import.meta.url).pathname],{detached:true,stdio:'ignore',env:process.env});p.unref();for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,200));try{await once('ping',{});return;}catch{}}throw Error('Learning runtime could not start.');})().finally(()=>starting=null);
 await starting;return once(method,params);
}
export const runtimeCall=compatibleRuntime({send:rawRuntimeCall,build});
