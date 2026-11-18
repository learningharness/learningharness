import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {install} from './install.mjs';
test('installer retries registration without overwriting changed code, trusting hooks or touching learner memory',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-install-'));
 try{
  const source=join(root,'source'),destination=join(root,'installed');await mkdir(join(source,'plugin/.codex-plugin'),{recursive:true});await mkdir(join(source,'plugin/hooks'),{recursive:true});
  await writeFile(join(source,'plugin/.codex-plugin/plugin.json'),JSON.stringify({name:'learning-harness',version:'0.1.0-beta.1'}));await writeFile(join(source,'plugin/.mcp.json'),JSON.stringify({mcpServers:{learn:{command:'node',args:['server.mjs'],env:{}}}}));await writeFile(join(source,'plugin/hooks/hooks.json'),JSON.stringify({hooks:{PostToolUse:[{hooks:[{type:'command',command:'placeholder'}]}]}}));
  for(const name of ['server.mjs','runtime-service.mjs','chain-hook.mjs','view.html'])await writeFile(join(source,'plugin',name),'fixture '+name);
  const memory=join(root,'learner.json');await writeFile(memory,'keep this');let fail=true;const calls=[];
  const options={source,destination,nodeExecutable:'/runtime path/node',runCodex:async args=>{calls.push(args);if(fail){fail=false;throw Error('Registration unavailable');}}};
  await assert.rejects(install(options),/Registration unavailable/);const installed=await install(options);await install(options);assert.equal(installed.restartRequired,true);assert.equal(installed.status,'restart_required');
  const mcp=JSON.parse(await readFile(join(destination,'plugin/.mcp.json'),'utf8'));assert.equal(mcp.mcpServers.learn.command,'/runtime path/node');assert.deepEqual(mcp.mcpServers.learn.args,[join(destination,'plugin/server.mjs')]);
  assert.equal(await readFile(memory,'utf8'),'keep this');assert.equal(calls.filter(x=>x[1]==='add').length,2);assert.ok(calls.every(x=>!JSON.stringify(x).includes('trust')));
  const hooks=await readFile(join(destination,'plugin/hooks/hooks.json'),'utf8');assert.match(hooks,/PLUGIN_ROOT/);
  await writeFile(join(source,'plugin/server.mjs'),'different bytes');await assert.rejects(install(options),/different|differs/);assert.equal(await readFile(join(destination,'plugin/server.mjs'),'utf8'),'fixture server.mjs');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('upgrades replace only the previous local product source and restore it on registration failure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-upgrade-'));try{
  const source=join(root,'source'),old=join(root,'installed','0.1.0-beta.16'),destination=join(root,'installed','1.0.0');
  for(const dir of [source,old]){await mkdir(join(dir,'plugin/.codex-plugin'),{recursive:true});await mkdir(join(dir,'plugin/hooks'),{recursive:true});await writeFile(join(dir,'plugin/.codex-plugin/plugin.json'),JSON.stringify({name:'learning-harness',version:'1.0.0'}));}
  await writeFile(join(source,'plugin/.mcp.json'),JSON.stringify({mcpServers:{learn:{}}}));await writeFile(join(source,'plugin/hooks/hooks.json'),JSON.stringify({hooks:{}}));
  const calls=[];await assert.rejects(install({source,destination,runCodex:args=>{calls.push(args);if(args[2]==='list')return JSON.stringify({marketplaces:[{name:'learning-harness-desktop',root:old,marketplaceSource:{sourceType:'local'}}]});if(args[1]==='add')throw Error('plugin registration failed');}}),/registration failed/);
  assert.deepEqual(calls.filter(c=>c[2]==='remove').map(c=>c[3]),['learning-harness-desktop','learning-harness-desktop']);assert.deepEqual(calls.at(-1),['plugin','marketplace','add',old]);
 }finally{await rm(root,{recursive:true,force:true});}
});
