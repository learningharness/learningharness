import {substantiveTask} from '../../packages/learning/src/opening-context.js';
import {opportunityBackoff} from './opportunity-backoff.mjs';
import {claimStartup} from './startup-invitation.mjs';
import { captureHook, readinessOutput, validSessionId, hostID } from "./host-adapter.mjs";
import { readChain, writeChain, chainDirectory } from "./chain.mjs";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
try {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 2e5) process.exit(0);
  }
  const event = JSON.parse(input), id = event.session_id;
  if (!validSessionId(id)) process.exit(0);
  const mode = JSON.parse(readFileSync(join(chainDirectory, "state.json"), "utf8"));
  const startup=hostID==='codex'?claimStartup(chainDirectory,event):null;
  if(startup)console.log(JSON.stringify(startup));
  if (!mode.on) process.exit(0);
  await captureHook(chainDirectory, event);
  const target = join(chainDirectory, "watch-" + id + ".json"), tmp = target + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify({ id, at: Date.now() }), { mode: 0o600 });
  renameSync(tmp, target);
  opportunityBackoff(chainDirectory,id,event,readChain(id));
  if(event.hook_event_name==='UserPromptSubmit'&&substantiveTask(event.prompt)){const previous=readChain(id);if(previous?.runtime&&previous.status==='ready')writeChain(id,{...previous,status:'stale',runtimeKey:null});process.exit(0);}
  if(startup)process.exit(0);
  const output = readinessOutput(event.hook_event_name ?? "PostToolUse");
  if (!output) process.exit(0);
  try {
    const visible = JSON.parse(readFileSync(join(chainDirectory, "visible-" + id + ".json"), "utf8"));
    if (visible.until > Date.now()) process.exit(0);
  } catch {
  }
  const chain = readChain(id);
  if (chain?.status !== "ready" || chain.signalAt) process.exit(0);
  if(!opportunityBackoff(chainDirectory,id,{},chain,{deliver:true}))process.exit(0);
  writeChain(id, { ...chain, signalAt: Date.now() });
  console.log(JSON.stringify(output));
} catch {
  process.exitCode = 0;
}
