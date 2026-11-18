import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink,realpath,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,relative,dirname,extname,isAbsolute} from 'node:path';

const hash=value=>createHash('sha256').update(value).digest('hex');
const sensitive=path=>/(?:^|[/.\\])(?:\.env\b|credentials\b|secrets?\b|auth\.json)|private[_-]?key/i.test(path);
const codeExtensions=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.py','.go','.rs','.java','.rb','.css','.html','.sql','.json']);
// Only literal redirect/tee destinations are understood. Never evaluate shell
// syntax, expand variables, or infer a change from a command's mere presence.
function destinations(command){
 const paths=[];
 const pattern=/(?:>{1,2}(?![>&])|\btee(?:\s+-a)?)\s*(?:'([^'\n]+)'|"([^"\n]+)"|([^\s;|&<>]+))/g;
 for(const match of String(command).slice(0,32000).matchAll(pattern)){
  const path=match[1]??match[2]??match[3];
  if(!path||/[\x00-\x1f$`*?{}()~]/.test(path)||sensitive(path)||!codeExtensions.has(extname(path)))continue;
  if(!paths.includes(path))paths.push(path);if(paths.length===6)break;
 }
 return paths;
}
async function sample(cwd,path){
 const root=await realpath(cwd),file=resolve(root,path),rel=relative(root,file);
 if(!rel||rel.startsWith('..')||isAbsolute(rel)||sensitive(rel))return null;
 // A symlink is never a route to unrelated source or credentials.
 if(await realpath(dirname(file)).catch(()=>null)!==dirname(file))return null;
 let handle;
 try{
  handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const info=await handle.stat();
  if(!info.isFile()||info.size>128000)return null;
  const buffer=Buffer.alloc(128001);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);if(bytesRead!==info.size)return null;const bytes=buffer.subarray(0,bytesRead);if(bytes.includes(0))return null;
  return {path:file,hash:hash(bytes),content:bytes.toString('utf8').slice(0,3200)};
 }catch(error){if(error.code==='ENOENT')return {path:file,hash:null};return null;}
 finally{await handle?.close();}
}
export async function captureShellFiles(directory,event){
 if(event.tool_name!=='Bash'||typeof event.tool_use_id!=='string'||typeof event.cwd!=='string')return [];
 const folder=join(directory,'shell-writes',hash(event.session_id)),file=join(folder,hash(event.tool_use_id)+'.json');
 if(event.hook_event_name==='PreToolUse'){
  const before=[];
  for(const path of destinations(event.tool_input?.command)){const value=await sample(event.cwd,path);if(value)before.push({path:value.path,hash:value.hash});}
  if(before.length){await mkdir(folder,{recursive:true,mode:0o700});const temp=file+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify({cwd:await realpath(event.cwd),at:Date.now(),before}),{mode:0o600});await rename(temp,file);}
  return [];
 }
 if(!['PostToolUse','PostToolUseFailure'].includes(event.hook_event_name))return [];
 let pending;try{pending=JSON.parse(await readFile(file,'utf8'));}catch{return [];}
 await unlink(file).catch(()=>{});
 if(event.hook_event_name!=='PostToolUse'||pending.cwd!==await realpath(event.cwd)||Date.now()-pending.at>3600000)return [];
 const changed=[];
 for(const before of pending.before){
  const current=await sample(event.cwd,before.path);
  if(current?.hash&&current.hash!==before.hash)changed.push({version:1,id:`${event.tool_use_id}:shell-file:${changed.length}`,sessionId:event.session_id,type:'file.changed',data:{path:current.path,content:current.content}});
 }
 return changed;
}
