import {substantiveTask} from '../../packages/learning/src/opening-context.js';
import {opportunityBackoff} from '../desktop-runtime/opportunity-backoff.mjs';
import {claimLauncherRequest} from './launcher-control.mjs';
import {issueChatBinding} from '../../adapters/claude/src/chat-binding.js';
import {captureClaudeHook} from '../../adapters/claude/src/native-events.js';
import {chainDirectory,readChain,writeChain} from './chain.mjs';
import {createStore} from '../desktop-runtime/state.mjs';
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
const store=createStore(chainDirectory);
try{await writeFile(join(chainDirectory,"state.json"),JSON.stringify(store.read()),{mode:0o600,flag:"wx"});}catch(error){if(error.code!=="EEXIST")throw error;}
export async function handleHook(event){
 if(event.agent_id||event.agent_type)return null;
 const chatBinding=await issueChatBinding(chainDirectory,event);
 let control;
 if(event.hook_event_name==='SessionStart'){
  if(event.source==='startup' && store.read().showSessionLauncher===true && await claimLauncherRequest(chainDirectory,event)){
   const launcher=`LearningHarness session launcher preference: the user opted in to a launcher for each new session. Call show_learning_launcher once with chatBinding "${chatBinding}" as a UI-only action. Continue coding independently; do not open or expand the panel automatically; do not enable learning or prepare a lesson. This binding is local UI routing only. Never ask the user to copy a session ID.`;
   return {hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:launcher}};
  }
  const identity=`LearningHarness chat connection: use chatBinding "${chatBinding}" on LearningHarness calls explicitly requested by the user in this chat. This is local UI routing only; do not create a launcher or open learning automatically. Never ask the user to copy a session ID.`;
  return {hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:identity}};
 }
 // Opening the UI is control traffic, not a new coding task or evidence of
 // learning. Ignore its acknowledgement too, without reading the transcript.
 const uiTurn=join(chainDirectory,'ui-turn-'+event.session_id+'.json');
 if(event.hook_event_name==='UserPromptSubmit'){
  if(/^\s*\/learningharness:learn\s*$/i.test(event.prompt??'')){await writeFile(uiTurn,JSON.stringify({at:Date.now()}),{mode:0o600});return null;}
  await unlink(uiTurn).catch(()=>{});
 }else{
  try{const marker=JSON.parse(await readFile(uiTurn,'utf8'));if(Date.now()-marker.at<600000)return null;await unlink(uiTurn).catch(()=>{});}catch{}
 }
 if(!store.read().on)return control??null;
 await captureClaudeHook(chainDirectory,event);
 const path=join(chainDirectory,'watch-'+event.session_id+'.json'),temp=path+'.'+process.pid+'.tmp';
 await writeFile(temp,JSON.stringify({id:event.session_id,at:Date.now()}),{mode:0o600});await rename(temp,path);
 opportunityBackoff(chainDirectory,event.session_id,event,readChain(event.session_id));
 if(event.hook_event_name==='UserPromptSubmit'&&substantiveTask(event.prompt)){const previous=readChain(event.session_id);if(previous?.runtime&&previous.status==='ready')writeChain(event.session_id,{...previous,status:'stale',runtimeKey:null});return control??null;}
 if(event.hook_event_name!=='PostToolUse')return control??null;
 try{const visible=JSON.parse(await readFile(join(chainDirectory,'visible-'+event.session_id+'.json'),'utf8'));if(visible.until>Date.now())return null;}catch{}
 const chain=readChain(event.session_id);if(chain?.status!=='ready'||chain.signalAt)return null;
 if(!opportunityBackoff(chainDirectory,event.session_id,{},chain,{deliver:true}))return null;
 writeChain(event.session_id,{...chain,signalAt:Date.now()});
 return {hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:`LearningHarness has prepared one learning opportunity for this chat. Call show_ready_invitation once with chatBinding "${chatBinding}". UI-only: continue coding independently; do not open or expand the panel automatically.`}};
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url))try{
 let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>131072)process.exit(0);}
 const result=await handleHook(JSON.parse(text));if(result)console.log(JSON.stringify(result));
}catch{process.exitCode=0;}
