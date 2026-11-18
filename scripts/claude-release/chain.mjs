import {nativeDirectory} from '../../packages/hosts/src/user-data.js';
import {validSessionId} from '../../packages/hosts/src/native-host.js';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
export const chainDirectory=await nativeDirectory({host:'claude'});
export {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
export const invitationUri='ui://learning-harness/claude/v1/invitation';
function file(id){if(!validSessionId(id))throw Error('Exact chat identity required');return join(chainDirectory,'chain-'+id+'.json');}
export function readChain(id){try{return JSON.parse(readFileSync(file(id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function writeChain(id,value){mkdirSync(chainDirectory,{recursive:true,mode:0o700});const path=file(id),temp=path+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(value),{mode:0o600});renameSync(temp,path);}
