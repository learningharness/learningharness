// Local owner test utility; not included in customer plugin packages.
import {mkdir,lstat,readdir,readFile,rename,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const exists=async path=>{try{return await lstat(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
export async function stopLegacyWriter(pid,{home=homedir()}={}){
 if(!Number.isSafeInteger(pid)||pid<=0)return false;
 if(!alive(pid))return true;
 let command;
 try{command=execFileSync('/bin/ps',['-p',String(pid),'-o','args='],{encoding:'utf8',timeout:1500}).trim();}
 catch{if(!alive(pid))return true;throw Error(`Cannot verify learning writer ${pid}. Nothing was reset.`);}
 const prefix=process.execPath+' '+join(home,'.local/share/dontdumb/plugins')+'/';
 if(!command.startsWith(prefix)||!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?\/lib\/server\.mjs(?:\s|$)/.test(command.slice(prefix.length)))return false;
 // Recheck identity before signaling: never terminate a PID based on a lock alone.
 if(execFileSync('/bin/ps',['-p',String(pid),'-o','args='],{encoding:'utf8',timeout:1500}).trim()!==command)return false;
 try{process.kill(pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
 for(let n=0;n<50;n++){if(!alive(pid))return true;await new Promise(resolve=>setTimeout(resolve,100));}
 throw Error(`The verified legacy learning writer ${pid} did not stop. No force-kill or data reset was performed.`);
}
export async function resetLearningHarness({home=homedir(),stopLegacyWriters=false,hosts=['codex']}={}){
 if(!Array.isArray(hosts)||!hosts.length||hosts.some(host=>!['codex','claude'].includes(host)))throw Error('Choose codex and/or claude. Nothing was reset.');
 const current=join(home,'.local/share/learning-harness'),legacy=join(home,'.local/share/dontdumb');
 // Do not touch installed plugins, authentication, analytics or other-host state.
 const candidates=[['current/learner',join(current,'learner')],['legacy/learner.json',join(legacy,'learner.json')]];
 const roots=[];
 for(const host of new Set(hosts)){
  const stateNames=host==='claude'?['claude','claude-candidate']:['codex'];
  for(const name of stateNames){const root=join(current,name);candidates.push(['current/'+name,root]);roots.push(root);}
  const old=join(legacy,host);candidates.push(['legacy/'+host+'/state.json',join(old,'state.json')]);roots.push(old);
 }
 const preview=join(legacy,'native-preview');
 if(hosts.includes('codex')){roots.push(preview);if(await exists(preview))for(const item of await readdir(preview))if(item!=='claude')candidates.push(['legacy/native-preview/'+item,join(preview,item)]);}
 if(hosts.includes('claude')){const old=join(preview,'claude');candidates.push(['legacy/native-preview/claude',old]);roots.push(old);}
 for(const root of roots)for(const name of ['writer.lock','core/writer.lock']){
  const file=join(root,name);if(!await exists(file))continue;
  const pid=Number(await readFile(file,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<=0)throw Error('A learning writer lock cannot be verified. Nothing was reset.');
  if(!alive(pid))continue;
  if(stopLegacyWriters&&await stopLegacyWriter(pid,{home}))continue;
  throw Error(`LearningHarness writer ${pid} is still running. Off stops learning, but an open app or CLI can keep the service connected. Fully quit all ChatGPT/Codex instances, wait 90 seconds, then retry. Nothing was reset.`);
 }
 for(const directory of [join(current,'learner'),legacy,...roots.map(root=>join(root,'learner'))])if(await exists(join(directory,'learner.lock')))throw Error('Learning memory is busy. Close other LearningHarness sessions and try again. Nothing was reset.');
 const sources=[];
 for(const [name,source] of candidates){const info=await exists(source);if(!info)continue;if(info.isSymbolicLink())throw Error('Unexpected linked state path. Nothing was reset.');sources.push({name,source});}
 if(!sources.length)return {backup:null,moved:0};
 const backup=join(current,'backups','clean-slate-'+new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(backup,{recursive:true,mode:0o700});
 const moves=sources.map(({name,source})=>({source,destination:join(backup,name)}));
 await writeFile(join(backup,'restore-map.json'),JSON.stringify({createdAt:new Date().toISOString(),moves},null,2)+'\n',{mode:0o600});
 for(const {source,destination} of moves){await mkdir(join(destination,'..'),{recursive:true,mode:0o700});await rename(source,destination);}
 return {backup,moved:moves.length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await resetLearningHarness({stopLegacyWriters:true,hosts:process.argv.includes('--both')?['codex','claude']:['codex']});console.log(result.moved?'Clean slate ready. Previous memory and settings are backed up at:\n'+result.backup:'No previous learning state was found.');console.log('\nReopen the selected hosts and start fresh coding chats. Use More tools in Codex or the Learn button in Claude.\nYou should see the first-run tour. Plugin installation, account sign-in and PostHog history were left alone.');}
 catch(e){console.error(e.message);process.exitCode=1;}
}
