import {cp,mkdir,readFile,writeFile,lstat,readdir,rename,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';import {homedir} from 'node:os';import {join,dirname,resolve,delimiter} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
const rewritten=new Set(['plugin/.mcp.json','plugin/hooks/hooks.json']);
async function samePackage(source,destination,prefix=''){
 for(const entry of await readdir(source,{withFileTypes:true})){
  const relative=prefix+entry.name,from=join(source,entry.name),to=join(destination,entry.name),target=await lstat(to);
  if(target.isSymbolicLink()||entry.isSymbolicLink())throw Error('Installed package differs: symbolic link found.');
  if(entry.isDirectory()){if(!target.isDirectory())throw Error('Installed package differs.');await samePackage(from,to,relative+'/');}
  else if(!rewritten.has(relative)&&(!target.isFile()||!(await readFile(from)).equals(await readFile(to))))throw Error('This version contains different package bytes. Use a new version; existing files are unchanged.');
 }
}
export async function install({source,destination,nodeExecutable=process.execPath,runCodex}){
 const manifest=JSON.parse(await readFile(join(source,'plugin/.codex-plugin/plugin.json'),'utf8'));
 if(manifest.name!=='learning-harness'||!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(manifest.version))throw Error('Invalid package identity');
 let present=false;try{const info=await lstat(destination);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Installation destination must be a directory.');present=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(present)await samePackage(source,destination);
 else{
  await mkdir(dirname(destination),{recursive:true,mode:0o700});const temporary=destination+'.'+randomUUID()+'.tmp';
  try{await cp(source,temporary,{recursive:true});await rename(temporary,destination);}finally{await rm(temporary,{recursive:true,force:true});}
 }
 const mcpPath=join(destination,'plugin/.mcp.json'),mcp=JSON.parse(await readFile(mcpPath,'utf8'));mcp.mcpServers.learn.command=nodeExecutable;mcp.mcpServers.learn.args=[join(destination,'plugin/server.mjs')];await writeFile(mcpPath,JSON.stringify(mcp,null,2)+'\n');
 const hooksPath=join(destination,'plugin/hooks/hooks.json'),hooks=JSON.parse(await readFile(hooksPath,'utf8'));for(const entries of Object.values(hooks.hooks))for(const entry of entries)for(const hook of entry.hooks)hook.command=JSON.stringify(nodeExecutable)+' "${PLUGIN_ROOT}/chain-hook.mjs"';await writeFile(hooksPath,JSON.stringify(hooks,null,2)+'\n');
 const listing=await runCodex(['plugin','marketplace','list','--json']);
 const previous=listing?JSON.parse(String(listing)).marketplaces?.find(m=>m.name==='learning-harness-desktop'):null;
 let priorRoot;
 if(previous&&resolve(previous.root)!==resolve(destination)){
  // Only replace our own versioned local installation, never an unrelated
  // marketplace that happens to use the same name.
  if(previous.marketplaceSource?.sourceType!=='local'||resolve(dirname(previous.root))!==resolve(dirname(destination)))throw Error('LearningHarness source already exists outside its installation directory. Keep it unchanged and review the update manually.');
  const prior=JSON.parse(await readFile(join(previous.root,'plugin/.codex-plugin/plugin.json'),'utf8'));
  if(prior.name!=='learning-harness')throw Error('Existing marketplace identity differs. Nothing was removed.');
  priorRoot=previous.root;await runCodex(['plugin','marketplace','remove','learning-harness-desktop']);
 }
 try{await runCodex(['plugin','marketplace','add',destination]);await runCodex(['plugin','add','learning-harness@learning-harness-desktop']);}
 catch(error){if(priorRoot){try{await runCodex(['plugin','marketplace','remove','learning-harness-desktop']);}catch{}await runCodex(['plugin','marketplace','add',priorRoot]);}throw error;}
 return {destination,version:manifest.version,status:'restart_required',restartRequired:true};
}
async function main(){
 if(process.argv.includes('--help')){console.log('Install LearningHarness for Codex desktop. Registers the plugin; restart the ChatGPT desktop app afterward. Leaves hook review to you and preserves learner memory. Safe to retry the same verified package.');return;}
 const [major,minor]=process.versions.node.split('.').map(Number);if(process.platform!=='darwin'||major<22||major===22&&minor<19)throw Error('Use macOS and Node.js 22.19 or later.');
 const source=dirname(fileURLToPath(import.meta.url)),manifest=JSON.parse(await readFile(join(source,'plugin/.codex-plugin/plugin.json'),'utf8'));
 const candidates=(process.env.PATH??'').split(delimiter).filter(Boolean).map(p=>join(p,'codex'));candidates.push('/Applications/Codex.app/Contents/Resources/codex','/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');const codex=candidates.find(existsSync);if(!codex)throw Error('Install Codex desktop and sign in before running this installer.');
 console.log('LearningHarness uses your existing Codex connection; no extra API key.\nNext, Codex will ask you to review local hooks. They notice active work and signal when a learning opportunity is ready. They do not change your project or generate lessons.\nPostHog usage metadata is on by default; you can turn it off in Learn settings. Code, prompts and answers are excluded.');
 await install({source,destination:join(homedir(),'.local/share/learning-harness/install/codex',manifest.version),runCodex:args=>execFileSync(codex,args,{stdio:args[1]==='marketplace'&&args[2]==='list'?['ignore','pipe','inherit']:'inherit'})});
 console.log('Registered — restart required. LearningHarness may not appear until you fully quit and reopen the ChatGPT desktop app. A new chat or closing the window is not a full restart.\nNext steps:\n1. Turn learning Off if updating, save and finish active work, then use ChatGPT → Quit ChatGPT (⌘Q). Wait 90 seconds before reopening after an update. Reopen ChatGPT yourself; this installer does not restart it.\n2. Open Plugins, select the LearningHarness Desktop source if needed, and find LearningHarness. Confirm it is installed and enabled, then start a fresh Codex coding chat.\n3. Select Review hooks above the composer or Settings → Hooks; review and trust LearningHarness. Registration did not approve hooks for you.\n4. In the coding chat, choose Add New Tab (+) → More tools → Open LearningHarness, or ask Codex: Open LearningHarness. Earlier versions label it Learn beside this chat. Finish setup, copy the starter task, choose Start learning, then paste and send the task in the coding chat. Use Off to stop learning.\nRegistration is not verification that the running desktop app has loaded the plugin. If it is still missing after restart, follow https://learningharness.dev/docs/troubleshooting/ .\nReinstalling preserves memory and saved settings. To revisit onboarding, open Learn settings → Review setup and hook permissions.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
