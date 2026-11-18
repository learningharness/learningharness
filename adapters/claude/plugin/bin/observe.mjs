#!/usr/bin/env node
// Best-effort hook transport. No transcript access, inference or model context.
import {readFile,writeFile,mkdir,rename,readdir,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
async function observe(){
 let raw='',large=false;for await(const chunk of process.stdin){if(raw.length+chunk.length>131072)large=true;if(!large)raw+=chunk;}if(large)return;
 const input=JSON.parse(raw||'{}'),id=input.session_id;
 if(typeof id!=='string'||!id||id.length>200||typeof input.cwd!=='string'||input.cwd.length>4000)return;
 const directory=process.env.LEARNING_HARNESS_STATE_DIR??process.env.DONTDUMB_STATE_DIR??join(homedir(),'.local/share/learning-harness/companion/claude');
 const sessions=join(directory,'sessions');await mkdir(sessions,{recursive:true,mode:0o700});
 const key=createHash('sha256').update(id).digest('hex'),temp=join(sessions,`${key}.${randomUUID()}.tmp`);
 await writeFile(temp,JSON.stringify({id,cwd:input.cwd,at:Date.now()}),{mode:0o600});await rename(temp,join(sessions,`${key}.json`));
 // Session descriptors hold no prompts or tool content. Retain only the newest100.
 const names=(await readdir(sessions)).filter(n=>/^[0-9a-f]{64}\.json$/.test(n));
 if(names.length>100){const entries=await Promise.all(names.map(async name=>{try{return {name,at:JSON.parse(await readFile(join(sessions,name),'utf8')).at??0};}catch{return {name,at:0};}}));for(const old of entries.sort((a,b)=>b.at-a.at).slice(100))await unlink(join(sessions,old.name)).catch(()=>{});}
 const control=JSON.parse(await readFile(join(directory,'companion.json'),'utf8')),url=new URL(control.url);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!/^#[0-9a-f]{48}$/.test(url.hash))return;
 const event={sessionId:id,id:input.tool_use_id??randomUUID()};const tool=input.tool_input??{};
 if(input.hook_event_name==='UserPromptSubmit')Object.assign(event,{kind:'task',text:String(input.prompt??'').slice(0,3200)});
 else if(input.hook_event_name==='Stop'&&typeof input.last_assistant_message==='string')Object.assign(event,{kind:'reply',text:input.last_assistant_message.slice(0,3200)});
 else if(['PostToolUse','PostToolUseFailure'].includes(input.hook_event_name)){
  if(input.hook_event_name==='PostToolUse'&&['Edit','Write'].includes(input.tool_name))Object.assign(event,{kind:'file',path:String(tool.file_path??'').slice(0,1000),content:String(tool.new_string??tool.content??'').slice(0,3200)});
  else if(input.hook_event_name==='PostToolUse'&&input.tool_name==='Read')Object.assign(event,{kind:'read',path:String(tool.file_path??'').slice(0,1000)});
  else if(input.tool_name==='Bash')Object.assign(event,{kind:'command',command:String(tool.command??'').slice(0,3200),output:String(input.tool_response?.stdout??input.tool_response?.stderr??'').slice(0,3200),failed:input.hook_event_name==='PostToolUseFailure'});
 }
 if(!event.kind)return;
 await fetch(url.origin+'/api/observe',{method:'POST',headers:{Authorization:'Bearer '+url.hash.slice(1),'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(400)});
}
observe().catch(()=>{});
