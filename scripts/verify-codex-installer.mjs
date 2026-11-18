import{mkdtemp,writeFile,chmod,readFile,stat,rm,mkdir}from'node:fs/promises';import{execFileSync,spawn}from'node:child_process';import{findCodex,CodexRpc}from'../adapters/codex/src/rpc.js';
const tmp=await mkdtemp('/tmp/dd-finder-native-');const opener=tmp+'/open';await writeFile(opener,'#!/bin/sh\nprintf "%s\\n" "$1" > "$HOME/opened"\n');await chmod(opener,0o755);
await mkdir(tmp+'/codex-profile');
try{const env={...process.env,HOME:tmp,CODEX_HOME:tmp+'/codex-profile',DONTDUMB_CODEX_BIN:findCodex(),DONTDUMB_OPEN_BIN:opener};
const legacy=tmp+'/legacy-beta';await mkdir(legacy+'/.agents/plugins',{recursive:true});await writeFile(legacy+'/.agents/plugins/marketplace.json',JSON.stringify({name:'dontdumb-beta',plugins:[]}));
execFileSync(findCodex(),['plugin','marketplace','add',legacy],{env});
execFileSync('/bin/zsh',[process.cwd()+'/artifacts/dontdumb-codex-beta-0.1.0-beta.16/Install LearningHarness.app/Contents/MacOS/install'],{env});
const installed=JSON.parse(execFileSync(findCodex(),['plugin','list','--json'],{env,encoding:'utf8'}));if(!installed.installed.some(p=>p.name==='dontdumb'&&p.enabled))throw Error('Plugin not enabled');
const payload=tmp+'/.local/share/learning-harness/plugins/0.1.0-beta.16/';await stat(payload+'lib/server.mjs');await stat(payload+'dist/index.html');if((await readFile(tmp+'/opened','utf8')).trim()!=='codex://plugins/dontdumb@dontdumb-beta')throw Error('No plugin UI launch');
const rpc=new CodexRpc(spawn(findCodex(),['app-server','--listen','stdio://'],{env,stdio:['pipe','pipe','pipe']}));
try{await rpc.initialize();const detail=await rpc.request('plugin/read',{pluginName:'dontdumb',marketplacePath:tmp+'/.local/share/learning-harness/plugins/.agents/plugins/marketplace.json'});if(detail.plugin.hooks.length!==1)throw Error('Native runtime did not discover the LearningHarness readiness hook');}finally{rpc.close();}
console.log('PASS: Finder application entrypoint, complete embedded payload, real Codex local installation/enabling in isolated profile, native plugin-page deep link and actual discovery of the notification hook (without trusting or executing them).');
}catch(error){console.log(await readFile(tmp+'/.local/share/learning-harness/plugin-install.log','utf8').catch(()=>''));throw error;}finally{await rm(tmp,{recursive:true,force:true})}
