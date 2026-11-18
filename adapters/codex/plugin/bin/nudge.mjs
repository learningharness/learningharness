#!/usr/bin/env node
// Owner-approved Codex exception: one fixed readiness signal, never lesson data.
// Claude keeps UI-only systemMessage. Neither path controls coding tools.
import {readFile,writeFile,open,mkdir,rename,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
async function notice() {
 let raw='',oversized=false;
 // Host payloads include tool results. Bound memory without dropping ordinary
 // file reads, and never wait indefinitely for a host pipe that stays open.
 const inputDeadline=setTimeout(()=>process.stdin.destroy(),400);
 try {for await(const part of process.stdin){if(raw.length+part.length>1048576)oversized=true;if(!oversized)raw+=part;}}
 finally {clearTimeout(inputDeadline);}
 if(oversized)return;
 const input=JSON.parse(raw||'{}');
 const claude=process.env.DONTDUMB_HOST==='claude';
 const directory=process.env.LEARNING_HARNESS_STATE_DIR??process.env.DONTDUMB_STATE_DIR??join(homedir(),'.local/share/learning-harness/companion',process.env.DONTDUMB_HOST==='claude'?'claude':'codex');
 const nudge=JSON.parse(await readFile(join(directory,'nudge.json'),'utf8'));
 if(!nudge||nudge.sessionId!==input.session_id||!Number.isFinite(nudge.expiresAt)||nudge.expiresAt<=Date.now()||typeof nudge.message!=='string'||nudge.message.length>600)return;
 const claims=join(directory,'nudge-claims');await mkdir(claims,{recursive:true,mode:0o700});
 const lock=join(claims,'notice.lock');const guard=await open(lock,'wx',0o600);
 try {
  const event=String(input.hook_event_name??'').slice(0,40);
  await writeFile(join(claims,'invocation.tmp'),JSON.stringify({at:Date.now(),event,pid:process.pid,parentPid:process.ppid}),{mode:0o600});
  await rename(join(claims,'invocation.tmp'),join(claims,'invocation.json'));
  // Different native protocol versions use PascalCase or snake/camel case.
  if(!claude&&event&&event.replaceAll('_','').toLowerCase()!=='posttooluse')return;
  let last={at:0};
  try{last=JSON.parse(await readFile(join(claims,'last.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')return;}
  if(!Number.isFinite(last.at)||Date.now()-last.at<300000||last.id===nudge.id&&last.sessionId===nudge.sessionId)return;
  const handle=await open(join(claims,'last.tmp'),'w',0o600);
  try{await handle.writeFile(JSON.stringify({at:Date.now(),id:nudge.id,sessionId:nudge.sessionId}));}finally{await handle.close();}
  await rename(join(claims,'last.tmp'),join(claims,'last.json'));
  const output=claude?{systemMessage:nudge.message}:{hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:'LearningHarness has a learning opportunity ready for this chat. Briefly invite the user once in your next commentary: "Want to understand this change? Say open Learn." Continue coding; do not open the panel automatically or call learning tools.'}};
  process.stdout.write(JSON.stringify(output));
 } finally {await guard.close();await unlink(lock);}
}
notice().catch(()=>{}); // Missing, busy or corrupt attention state never gates work.
