import {spawn} from 'node:child_process';
import {CodexRpc,findCodex} from '../../adapters/codex/src/rpc.js';
// Separate from the read-only learning process. Coding is permitted only in the
// throwaway fixture workspace; plugins, hooks, MCP and web tools are disabled.
export async function startMainAgent(directory,task,model){
 const disabled=['plugins','hooks','apps','multi_agent','memories','browser_use','in_app_browser','computer_use'];
 const rpc=new CodexRpc(spawn(findCodex(),['app-server','--listen','stdio://','-c','web_search="disabled"','-c','skills.bundled.enabled=false','-c','skills.max_context_tokens=1','-c','project_doc_max_bytes=0',...disabled.flatMap(k=>['-c',`features.${k}=false`])],{stdio:['pipe','pipe','pipe']}));
 let timeout;let turnID;let threadID;let settled=false;let resolveDone;
 const done=new Promise(resolve=>{resolveDone=resolve;});let usage=null;
 const finish=status=>{if(settled)return;settled=true;clearTimeout(timeout);resolveDone(status);};
 const listener=({method,params:p})=>{
  if(p?.threadId!==threadID)return;
  if(method==='thread/tokenUsage/updated')usage=p.tokenUsage?.last??null;
  if(method==='turn/completed')finish(p.turn?.status??'failed');
  if(method==='error'&&!p.willRetry)finish('failed');
 };
 try{
  await rpc.initialize();const account=await rpc.request('account/read',{refreshToken:false});if(account.account?.type!=='chatgpt')throw Error('Eval requires the existing ChatGPT subscription connection');const config=await rpc.request('config/read',{includeLayers:false});
  const disabledMcp={sandbox_workspace_write:{network_access:false,writable_roots:[],exclude_tmpdir_env_var:true,exclude_slash_tmp:true},mcp_servers:Object.fromEntries(Object.keys(config.config?.mcp_servers??{}).map(name=>[name,{enabled:false}]))};
  const started=await rpc.request('thread/start',{model,modelProvider:'openai',cwd:directory,sandbox:'workspace-write',approvalPolicy:'never',ephemeral:false,config:disabledMcp,developerInstructions:'You are the coding worker in an isolated LearningHarness evaluation. Implement the user task. Read/write only this fixture directory; no network, credentials, external services or files outside it. Do not use LearningHarness, teach the learner or invoke companion controls. Use only built-in tools and node for tests.'});
  threadID=started.thread.id;rpc.on('notification',listener);rpc.on('disconnected',()=>finish('disconnected'));
  return {rpc,threadID,usage:()=>usage,done,start:async()=>{
   timeout=setTimeout(()=>{finish('timeout');if(turnID)void rpc.request('turn/interrupt',{threadId:threadID,turnId:turnID}).catch(()=>{});},120000);
   try{const started=await rpc.request('turn/start',{threadId:threadID,input:[{type:'text',text:task}],effort:'low',summary:'none',sandboxPolicy:{type:'workspaceWrite',writableRoots:[directory],networkAccess:false,excludeTmpdirEnvVar:true,excludeSlashTmp:true}});turnID=started.turn.id;}catch{finish('failed');}
  },close:async()=>{if(!settled&&turnID)await rpc.request('turn/interrupt',{threadId:threadID,turnId:turnID}).catch(()=>{});clearTimeout(timeout);if(threadID)await rpc.request('thread/archive',{threadId:threadID}).catch(()=>{});rpc.off('notification',listener);rpc.close();}};
 }catch(error){rpc.close();throw error;}
}
