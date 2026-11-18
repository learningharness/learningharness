// Explicit acceptance of a built runtime, never an installed/real learner root.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,chmod,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {issueChatBinding} from '../../adapters/claude/src/chat-binding.js';
import {runtimeCall} from './runtime-client.mjs';
export async function smokeBundledDesktopRuntime(packageDirectory,expectedVersion='1.0.0-beta.50'){
 const candidate=JSON.parse(await readFile(join(packageDirectory,'candidate.json'),'utf8'));assert.equal(candidate.version,expectedVersion,'Smoke test must use the explicitly intended immutable build');
 const temp=await mkdtemp(join(tmpdir(),'lh-bundled-controls-')),data=join(temp,'data'),learner=join(temp,'learner'),project=join(temp,'synthetic-project'),called=join(temp,'unexpected-cli-call');
 await mkdir(project);const chat='11111111-1111-4111-8111-111111111111';await issueChatBinding(data,{session_id:chat,cwd:project});
 const executable=join(temp,'no-model-cli');await writeFile(executable,'#!/bin/sh\nprintf called > "$LH_CLI_SMOKE_CALLED"\nexit 99\n',{mode:0o700});await chmod(executable,0o700);
 const env={...process.env,LEARNING_HARNESS_HOST:'claude',LEARNING_HARNESS_DATA_DIR:data,DONTDUMB_PROBE_DATA:data,LEARNING_HARNESS_LEARNER_DIR:learner,DONTDUMB_LEARNER_DIR:learner,DONTDUMB_CLAUDE_BIN:executable,LH_CLI_SMOKE_CALLED:called};delete env.LH_DESKTOP_HOST;delete env.LH_DESKTOP_DATA_DIR;
 const child=spawn(process.execPath,[join(packageDirectory,'runtime-service.mjs')],{env,stdio:['ignore','ignore','pipe']});let diagnostics='';child.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-2000);});
 let exited=false;const stopped=new Promise(done=>child.once('exit',()=>{exited=true;done();}));let startupError;child.once('error',error=>{startupError=error;});
 const call=(method,params={})=>runtimeCall(method,params,{env});
 try{
  let provenance;
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   if(startupError)throw startupError;if(exited)throw Error('Bundled runtime exited before acceptance: '+diagnostics);
   try{provenance=await call('ping');if(provenance.error)throw Error(provenance.error);if(provenance.ready)break;}catch(error){if(exited)throw error;}
   await new Promise(done=>setTimeout(done,100));
  }
  assert.equal(provenance?.ready,true,'Bundled runtime must initialize');assert.equal(provenance.host,'claude');
  const before=await call('desktop-status');assert.equal(before.enabled,false);
  assert.deepEqual(await call('desktop-action',{action:'off'}),{enabled:false});
  const chats=await call('desktop-chats');assert.deepEqual(chats,{enabled:false,chats:[{id:chat,title:'Claude Code · 11111111',project:'synthetic-project',paused:false}]});
  let modelCalled=false;try{await access(called);modelCalled=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(modelCalled,false,'Desktop controls must not invoke the Claude CLI');
  const report={passed:true,version:candidate.version,host:provenance.host,build:provenance.build,directory:temp,checks:['desktop-status','desktop-action:off','desktop-chats:exact-descriptor'],cliInvocations:0};await writeFile(join(temp,'report.json'),JSON.stringify(report,null,2),{mode:0o600});return report;
 }finally{
  if(!exited){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);try{await stopped;}finally{clearTimeout(timer);}}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(!process.argv[2])throw Error('Pass an explicitly built Claude package directory.');
 console.log(JSON.stringify(await smokeBundledDesktopRuntime(resolve(process.argv[2]),process.argv[3]??'1.0.0-beta.50')));
}
