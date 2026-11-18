import assert from 'node:assert/strict';
import {request} from 'node:http';
import {pathToFileURL} from 'node:url';
import {mkdtemp,writeFile,readFile,mkdir,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]??'artifacts/dontdumb-claude-beta-0.1.0-beta.5'),temp=await mkdtemp(join(tmpdir(),'dd-claude-check-'));
const fake=join(temp,'claude'),directory=join(temp,'state');await mkdir(directory);
const goal={kind:'core',outcome:'How local memory stays safe',whyNow:'The work adds a local file store',minutes:2,path:['Atomic writes','Locks','Portability'],insight:'Atomic replacement prevents partial files. A lock around the entire read, merge and write also prevents lost updates.'};
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('auth')){if(process.argv.includes('login')){require('node:fs').writeFileSync(process.env.DONTDUMB_TEST_AUTH_FILE,'connected');process.exit(0);}const connected=!process.env.DONTDUMB_TEST_SIGNED_OUT||require('node:fs').existsSync(process.env.DONTDUMB_TEST_AUTH_FILE);console.log(JSON.stringify({loggedIn:connected,authMethod:connected?'claude.ai':'none',apiProvider:'firstParty',subscriptionType:'fixture'}));if(!connected)process.exitCode=1;}else if(process.argv.includes('-p')){let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{console.log(JSON.stringify({type:'result',result:JSON.stringify({tool:'suggest_goals',input:{goals:[${JSON.stringify(goal)}]},reason:'Synthetic local memory change'}),usage:{input_tokens:50,output_tokens:20}}));});}else {process.exitCode=1;}
`);await chmod(fake,0o755);
const env={...process.env,DONTDUMB_NODE_BIN:process.execPath,DONTDUMB_CLAUDE_BIN:fake,DONTDUMB_STATE_DIR:directory,DONTDUMB_LEARNER_DIR:join(temp,'learner'),DONTDUMB_POSTHOG_TOKEN:'disabled',DONTDUMB_TEST_AUTH_FILE:join(temp,'auth')};
const run=(args,extraEnv={})=>execFileSync('/bin/zsh',[join(root,'bin/start'),...args],{env:{...env,...extraEnv},encoding:'utf8',timeout:25000}).trim();
const hook=input=>execFileSync(process.execPath,[join(root,'bin/observe.mjs')],{env,input:JSON.stringify(input),encoding:'utf8',timeout:3000});
let api,stopWorker=()=>{};
const project=join(temp,'project');await mkdir(project);
const socketCall=(path,body)=>new Promise((resolve,reject)=>{const req=request({socketPath:join(directory,'bridge-v2.sock'),path:'/v2/'+path,method:'POST',headers:{'Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end(body);});
try {
 assert.match(run(['--doctor']),/No inference/);
 assert.equal(hook({session_id:'fixture-chat',cwd:project,hook_event_name:'SessionStart'}),'');
 const url=new URL(run([project,'--no-open'],{DONTDUMB_TEST_SIGNED_OUT:'1'}));
 api=async(path,input={})=>{const r=await fetch(url.origin+'/api/'+path,{method:'POST',headers:{Authorization:'Bearer '+url.hash.slice(1),'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(r.status,200);return r.json();};
 const disconnected=await api('bootstrap');assert.equal(disconnected.auth.connected,false);
 const denied=await fetch(url.origin+'/api/attach',{method:'POST',headers:{Authorization:'Bearer '+url.hash.slice(1),'Content-Type':'application/json'},body:JSON.stringify({threadId:'fixture-chat'})});assert.equal(denied.status,400);assert.match((await denied.json()).error,/Open LearningHarness/);
 // Execute the actual packaged module with a synthetic native SDK. No CLI
 // credentials, provider requests or real learner data participate.
 const {register}=await import(pathToFileURL(join(root,'hooks/register.js')));
 const expectedOpportunityModel=(await api('status')).defaultContextModel?.modelID??'opus-fixture';
 const handlers={};let timer,modelCalls=0;
 const sdk={env:{get:async key=>key==='HOME'?temp:key==='DONTDUMB_STATE_DIR'?directory:null},session:{id:async()=> 'fixture-chat',cwd:async()=>project,model:async()=> 'opus-fixture',authorize:async()=>({kind:'bearer'})},clock:{every:(ms,cb)=>{timer=setInterval(cb,ms);return {cancel(){clearInterval(timer);}};}},http:{fetch:async(url,options)=>socketCall(url.split('/').at(-1),options.body)},model:{complete:async(req)=>{modelCalls++;assert.equal(req.model,expectedOpportunityModel);return {isAnswered:true,text:JSON.stringify({tool:'suggest_goals',input:{goals:[goal]},reason:'Synthetic local memory change'}),usage:{input_tokens:50,output_tokens:20}};}}};
 register((event,handler)=>handlers[event]=handler);
 stopWorker=()=>clearInterval(timer);
 await handlers['session.start'](sdk,{},async()=>({cwd:project}));
 for(let i=0;i<40;i++){if((await api('bootstrap')).auth.connected)break;await new Promise(r=>setTimeout(r,50));}
 const bootstrap=await api('bootstrap');assert.equal(bootstrap.auth.connected,true);assert.equal(bootstrap.hostLabel,'Claude Code');assert.equal(bootstrap.threads[0].id,'fixture-chat');
 assert.equal((await fetch(url.origin+'/api/open',{method:'POST'})).status,403);
 await api('attach',{threadId:'fixture-chat'});
 assert.equal((await api('observe',{sessionId:'other',id:'x',kind:'task',text:'Never observe this'})).accepted,false);
 hook({session_id:'fixture-chat',cwd:project,hook_event_name:'UserPromptSubmit',prompt:'Build a local learner memory store with safe writes and portable import export'});
 let status;for(let i=0;i<30;i++){status=await api('status',{visible:false});if(status.session?.goals)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(status.session?.goals?.list?.length,`No goal published: ${JSON.stringify(status.fault??status.session?.phase)}`);
 assert.equal(status.session.goals.list[0].outcome,goal.outcome);
 await api('status',{visible:false,closed:true});status=await api('status');assert.ok(status.session.nudgeSuppressedUntil>Date.now());
 assert.equal(JSON.parse(await readFile(join(directory,'nudge.json'),'utf8')),null);
 const before=status.openRequest;assert.equal(run(['--no-open']),url.href);status=await api('status');assert.equal(status.openRequest,before+1);assert.equal(status.enabled,true);
 const native=execFileSync(process.execPath,[join(root,'bin/nudge.mjs')],{env,input:JSON.stringify({session_id:'fixture-chat'}),encoding:'utf8'});assert.equal(native,'');
 await api('command',{action:'disable',sessionID:'fixture-chat'});
 assert.equal((await api('observe',{sessionId:'fixture-chat',id:'off',kind:'task',text:'Off means no observation'})).accepted,false);
 assert.ok(modelCalls>0);
 await handlers['session.end'](sdk,{},async()=>({}));
 assert.equal((await api('auth/connect')).pending,true);
 for(let i=0;i<40;i++){if((await api('bootstrap')).auth.connected)break;await new Promise(r=>setTimeout(r,50));}
 assert.equal((await api('bootstrap')).auth.connected,true);
 console.log('PASS: Claude packaged native module, session discovery, subscription bridge, explicit CLI fallback, hook registration/transport, selected-session observation, synthetic goals, close/cooldown, authenticated explicit reopen and off controls. No real model or learner profile used.');
 if(process.env.DONTDUMB_KEEP_FIXTURE){await api('command',{action:'enable',sessionID:'fixture-chat'});console.log(JSON.stringify({url:url.href,directory,temp}));}
} catch(error){console.error(await readFile(join(directory,'companion.log'),'utf8').catch(()=>''));throw error;}
finally {stopWorker();if(!process.env.DONTDUMB_KEEP_FIXTURE){try{run(['--stop']);}catch{}for(let i=0;i<40;i++){try{await readFile(join(directory,'writer.lock'));}catch{break;}await new Promise(r=>setTimeout(r,50));}await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}
