// Native OAuth login owns credentials and its loopback callback. This bridge
// exposes only an allowlisted authorization-page URL, never tokens or raw output.
export function subscriptionLogin({spawnProcess,executable,directory,env,onComplete=async()=>{}}) {
 let child=null,timer;const state={pending:false,url:null,error:''};
 const close=()=>{clearTimeout(timer);child?.kill('SIGTERM');child=null;state.pending=false;};
 const start=()=>{
  if(state.pending)return {...state};
  state.pending=true;state.url=null;state.error='';
  const process=spawnProcess(executable,['auth','login','--claudeai'],{cwd:directory,env,stdio:['ignore','pipe','pipe']});child=process;
  let tail='';
  const inspect=chunk=>{
   tail=(tail+String(chunk)).slice(-12000);
   for(const candidate of tail.match(/https:\/\/[^\s"'<>\x1b]+/g)??[]){try{const url=new URL(candidate);if(['claude.ai','platform.claude.com','console.anthropic.com'].includes(url.hostname)&&url.pathname==='/oauth/authorize'&&!url.username&&!url.password&&!url.hash)state.url=url.href;}catch{}}
  };
  process.stdout.on('data',inspect);process.stderr.on('data',inspect);
  process.once('error',()=>{if(child!==process)return;clearTimeout(timer);child=null;state.pending=false;state.error='Could not open Claude subscription sign-in. Try again.';});
  process.once('close',code=>{if(child!==process)return;clearTimeout(timer);child=null;state.pending=false;state.url=null;if(code!==0)state.error='Claude subscription sign-in was not completed. You can retry.';else void onComplete().catch(()=>{state.error='Sign-in finished, but the connection could not be verified. Check connection again.';});});
  timer=setTimeout(()=>{if(child!==process)return;state.error='Sign-in timed out. You can retry.';close();},180000);timer.unref?.();
  return {...state};
 };
 return {start,close,status:()=>({...state})};
}
