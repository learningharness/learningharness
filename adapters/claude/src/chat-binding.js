import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,open,writeFile,link,unlink,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {validSessionId,identityFrom} from '../../../packages/hosts/src/native-host.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const validToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const validProject=value=>typeof value==='string'&&value.length<=4000&&isAbsolute(value)&&!value.includes('\0');
async function folder(path){await mkdir(path,{recursive:true,mode:0o700});const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Unsafe chat binding directory');}
async function read(path){
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const info=await file.stat();if(!info.isFile()||info.size>8192||(info.mode&0o077))throw Error('Unsafe chat binding record');return JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
}
// Link an already complete file: simultaneous starts cannot observe partial JSON.
async function install(path,value){
 const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});
 try{try{await link(temp,path);}catch(e){if(e.code!=='EEXIST')throw e;}}finally{await unlink(temp);}
 return read(path);
}
export async function issueChatBinding(directory,input){
 if(!validSessionId(input?.session_id)||!validProject(input?.cwd)||input.agent_id||input.agent_type)throw Error('An exact main Claude Code chat is required');
 await folder(directory);for(const name of ['bindings','binding-tokens','sessions'])await folder(join(directory,name));
 const id=input.session_id,key=hash(id);
 const saved=await install(join(directory,'bindings',key+'.json'),{id,token:randomBytes(32).toString('hex')});
 if(saved.id!==id||!validToken(saved.token))throw Error('Invalid chat binding record');
 const mapped=await install(join(directory,'binding-tokens',saved.token+'.json'),{id});
 if(mapped.id!==id)throw Error('Conflicting chat binding');
 const target=join(directory,'sessions',key+'.json');
 const old=await install(target,{id,cwd:input.cwd,at:Date.now()});
 if(old.id!==id||!validProject(old.cwd))throw Error('Invalid Claude chat descriptor');
 // Keep the same chat binding if the user changes the working directory.
 const temp=target+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({id,cwd:input.cwd,at:Date.now()}),{mode:0o600,flag:'wx'});await rename(temp,target);
 return saved.token;
}
export async function resolveChatBinding(directory,token,metadata){
 if(!validToken(token))throw Error('Reopen LearningHarness from this Claude Code chat to reconnect automatically.');
 for(const name of ['', 'bindings','binding-tokens','sessions']){const info=await lstat(join(directory,name));if(!info.isDirectory()||info.isSymbolicLink())throw Error('Unsafe chat binding directory');}
 const mapped=await read(join(directory,'binding-tokens',token+'.json'));
 if(!validSessionId(mapped.id))throw Error('Invalid chat binding');
 const binding=await read(join(directory,'bindings',hash(mapped.id)+'.json'));
 const session=await read(join(directory,'sessions',hash(mapped.id)+'.json'));
 if(binding.id!==mapped.id||binding.token!==token||session.id!==mapped.id||!validProject(session.cwd))throw Error('Conflicting chat binding');
 const supplied=identityFrom(metadata);if(supplied&&supplied!==mapped.id)throw Error('Conflicting host chat identity');
 return mapped.id;
}

export async function readClaudeSession(directory,id){
 if(!validSessionId(id))throw Error('An exact Claude Code chat is required');
 const session=await read(join(directory,'sessions',hash(id)+'.json'));
 if(session.id!==id||!validProject(session.cwd))throw Error('Invalid Claude chat descriptor');
 return {title:'Claude Code · '+id.slice(0,8),project:session.cwd};
}
