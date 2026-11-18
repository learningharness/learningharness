export function compatibleRuntime({send,build,now=Date.now}){
 let retryAt=0;
 const mismatch=()=>Error('LearningHarness found an older background runtime. Fully quit Codex, wait 90 seconds, then reopen it. Memory and settings are preserved.');
 return async(method,params={})=>{
  if(now()<retryAt)throw mismatch();
  const ping=await send('ping',{});
  if(ping.build!==build){retryAt=now()+90000;throw mismatch();}
  return method==='ping'?ping:send(method,params);
 };
}
