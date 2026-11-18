import {homedir} from 'node:os';import {join,relative,sep} from 'node:path';
import {mkdir,readdir,lstat,readFile,writeFile,open,copyFile,chmod,link,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';
export const userDataRoot=(home=homedir())=>join(home,'.local','share','learning-harness');
const transient=name=>name.endsWith('.sock')||name.endsWith('.tmp')||/^(writer\.lock|learner\.lock|companion\.json|service\.json|nudge\.json|\.migration.*|ui-diagnostics-.*)$/.test(name);
async function exists(path){try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
// Copy-once migration: old data remains recoverable. Never follow links, copy
// endpoints/locks, replace current state, or move files under a live writer.
export async function migrateLocalDirectory(source,destination,{entries,omit=[]}={}){
 if(source===destination||!await exists(source))return destination;
 const marker=join(destination,'.migration-'+createHash('sha256').update(source+JSON.stringify(entries??null)).digest('hex').slice(0,16)+'.json');
 if(await exists(marker))return destination;
 if(!(await lstat(source)).isDirectory()||(await lstat(source)).isSymbolicLink())throw Error('Legacy LearningHarness data must be a real directory');
 const files=[];
 async function scan(folder,depth=0){for(const item of await readdir(folder,{withFileTypes:true})){
  if(depth===0&&(omit.includes(item.name)||entries&&!entries.includes(item.name)))continue;
  const path=join(folder,item.name);
  if(item.isSymbolicLink())continue;
  if(item.name==='writer.lock'||item.name==='learner.lock'){
   let active=item.name==='learner.lock';
   if(!active){const pid=Number(await readFile(path,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)active=true;else try{process.kill(pid,0);active=true;}catch(e){active=e.code!=='ESRCH';}}
   if(active)throw Error('Restart the learning companions to finish the LearningHarness data migration; existing data is unchanged.');
  }
  if(transient(item.name)||['worker','node_modules','nudge-claims'].includes(item.name))continue;
  if(item.isDirectory())await scan(path,depth+1);else if(item.isFile())files.push(path);
 }}
 await scan(source);
 if(await exists(destination)&&(await lstat(destination)).isSymbolicLink())throw Error('LearningHarness data destination cannot be a symlink');
 await mkdir(destination,{recursive:true,mode:0o700});
 const lockPath=join(destination,'.migration.lock');let guard;
 for(let n=0;n<30;n++){try{guard=await open(lockPath,'wx',0o600);await guard.writeFile(String(process.pid));break;}catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(await readFile(lockPath,'utf8').catch(()=>''));if(Number.isSafeInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(alive){if(alive.code==='ESRCH'){await unlink(lockPath).catch(()=>{});continue;}}}await new Promise(r=>setTimeout(r,25));}}
 if(!guard)throw Error('LearningHarness data migration is busy; retry shortly.');
 async function install(from,to){let parent=destination;for(const part of relative(destination,join(to,'..')).split(sep).filter(Boolean)){parent=join(parent,part);await mkdir(parent,{recursive:true,mode:0o700});if((await lstat(parent)).isSymbolicLink())throw Error('LearningHarness migration found an unsafe destination');}const temp=to+'.'+randomUUID()+'.tmp';try{await copyFile(from,temp,constants.COPYFILE_EXCL);await chmod(temp,0o600);try{await link(temp,to);}catch(e){if(e.code!=='EEXIST')throw e;}}finally{await unlink(temp).catch(()=>{});}}
 try{
  if(await exists(marker))return destination;
  for(const from of files){const name=relative(source,from),to=join(destination,name);if(await exists(to)){
   if(!(await lstat(to)).isFile()||(await lstat(to)).isSymbolicLink())throw Error('LearningHarness migration found an unsafe destination');
   if(!(await readFile(from)).equals(await readFile(to)))await install(from,join(destination,'migration-backup',name));
  }else await install(from,to);}
  await writeFile(marker,JSON.stringify({version:1,files:files.length,completedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
  return destination;
 }finally{await guard.close();await unlink(lockPath).catch(()=>{});}
}
export async function companionDirectory({host='codex',env=process.env,home=homedir()}={}){
 const explicit=env.LEARNING_HARNESS_STATE_DIR??env.DONTDUMB_STATE_DIR;if(explicit)return explicit;
 const target=join(userDataRoot(home),'companion',host);
 return migrateLocalDirectory(join(home,'.local/share/dontdumb',host),target);
}
export async function nativeDirectory({host='codex',env=process.env,home=homedir()}={}){
 const explicit=env.LEARNING_HARNESS_DATA_DIR??env.DONTDUMB_PROBE_DATA;if(explicit)return explicit;
 const target=join(userDataRoot(home),host),legacy=join(home,'.local/share/dontdumb/native-preview',...(host==='claude'?['claude']:[]));
 return migrateLocalDirectory(legacy,target,{omit:host==='codex'?['claude']:[]});
}
