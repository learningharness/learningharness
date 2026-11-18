import {homedir} from 'node:os';import {join,resolve} from 'node:path';
import {mkdir,cp,readFile,writeFile,copyFile,lstat,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
const exec=promisify(execFile);
const ownDirectory=fileURLToPath(new URL('.',import.meta.url));
async function installerSource(){try{await readFile(join(ownDirectory,'candidate.json'));return ownDirectory;}catch(error){if(error.code!=='ENOENT')throw error;return resolve('artifacts/claude-native-candidate');}}
export const cliRequirement='Claude support requires the local Claude Code CLI signed in with an active Claude subscription. Desktop sign-in alone may not cover it. If needed, use claude auth login through Claude’s normal browser flow. LearningHarness does not collect passwords or extract login tokens.';
export function desktopConfig(config,entry){
 if(!config||typeof config!=='object'||Array.isArray(config)||config.mcpServers&&(typeof config.mcpServers!=='object'||Array.isArray(config.mcpServers)))throw Error('Invalid Claude Desktop configuration');
 return {...config,mcpServers:{...config.mcpServers,'learningharness-claude-candidate':entry}};
}
export async function installCandidate({home=homedir(),source,node=process.execPath,cli=join(home,'.local/bin/claude'),run=exec}={}){
 console.log(cliRequirement);
 source??=await installerSource();
 const version=JSON.parse(await readFile(join(source,'candidate.json'),'utf8')).version;
 if(!/^1\.0\.0-beta\.\d+$/.test(version))throw Error('Invalid candidate version');
 const marketplace=join(home,'.local/share/learning-harness/claude-native-candidate'),plugin=join(marketplace,version,'plugin');
 await mkdir(join(marketplace,'.claude-plugin'),{recursive:true,mode:0o700});
 await mkdir(plugin,{recursive:true,mode:0o700});await cp(source,plugin,{recursive:true});
 await writeFile(join(marketplace,'.claude-plugin/marketplace.json'),JSON.stringify({name:'learningharness-claude-candidate',description:'LearningHarness native Claude Code candidate. Requires normal Claude Code CLI subscription sign-in.',owner:{name:'LearningHarness'},plugins:[{name:'learningharness',source:'./'+version+'/plugin',description:cliRequirement}]},null,2),{mode:0o600});
 const state=join(home,'.local/share/learning-harness/claude-candidate'),learner=join(state,'learner');
 await writeFile(join(plugin,'entry-state.json'),JSON.stringify({directory:state}),{mode:0o600});
 // Hooks and Desktop's independent MCP connection must share the exact same root.
 const hooksFile=join(plugin,'hooks/hooks.json'),hooks=JSON.parse(await readFile(hooksFile,'utf8'));
 for(const groups of Object.values(hooks.hooks))for(const group of groups)for(const hook of group.hooks){hook.command='LEARNING_HARNESS_DATA_DIR='+shell(state)+' LEARNING_HARNESS_LEARNER_DIR='+shell(learner)+' '+shell(node)+' "${CLAUDE_PLUGIN_ROOT}/hook.mjs"';}
 await writeFile(hooksFile,JSON.stringify(hooks,null,2),{mode:0o600});
 // Supported plugin controls preserve other plugins and leave hook review to Claude.
 await run(cli,['plugin','marketplace','add',marketplace]);
 await run(cli,['plugin','install','learningharness@learningharness-claude-candidate']);
 await run(cli,['plugin','update','learningharness@learningharness-claude-candidate']);
 const dir=join(home,'Library/Application Support/Claude'),file=join(dir,'claude_desktop_config.json');await mkdir(dir,{recursive:true});
 let config={},backup=null;
 try{const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe Claude Desktop configuration');config=JSON.parse(await readFile(file,'utf8'));backup=file+'.learningharness-backup-'+randomUUID();await copyFile(file,backup);}catch(error){if(error.code!=='ENOENT')throw error;}
 const value=desktopConfig(config,{command:node,args:[join(plugin,'server.mjs')],env:{LEARNING_HARNESS_DATA_DIR:state,LEARNING_HARNESS_LEARNER_DIR:learner}});
 const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,file);
 // Installation is not verified until both registrations and installed bytes agree.
 const listed=await run(cli,['plugin','list','--json']);
 let entries;try{entries=JSON.parse(listed.stdout);}catch{throw Error('Claude plugin registration could not be verified. Do not report installation complete.');}
 const installed=Array.isArray(entries)&&entries.find(item=>item.id==='learningharness@learningharness-claude-candidate'&&item.version===version&&item.enabled===true);
 if(!installed||typeof installed.installPath!=='string')throw Error('Claude plugin version or enabled state does not match this candidate. Do not report installation complete.');
 for(const filename of ['server.mjs','runtime-service.mjs','hook.mjs','view.html','register.mjs','entry-status.mjs'])if(!(await readFile(join(installed.installPath,filename))).equals(await readFile(join(plugin,filename))))throw Error('Claude plugin files differ from this candidate. Do not report installation complete.');
 const registered=JSON.parse(await readFile(file,'utf8')).mcpServers?.['learningharness-claude-candidate'];
 if(registered?.args?.[0]!==join(plugin,'server.mjs')||registered?.env?.LEARNING_HARNESS_DATA_DIR!==state)throw Error('Claude Desktop connector does not match this candidate. Do not report installation complete.');

 return {verified:true,version,plugin,desktopConnectorServer:join(plugin,'server.mjs'),state,backup,note:cliRequirement,restartRequired:true,publicRelease:false};
}
function shell(value){return "'"+value.replaceAll("'","'\\''")+"'";}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await installCandidate(),null,2));
