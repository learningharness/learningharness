import test from 'node:test';import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {ClaudeLearningGateway,claudeEnvironment} from '../src/host.js';
import {normalizeClaudeEvent} from '../src/observer.js';
function fake(result,exitCode=0){let call;const spawnProcess=(bin,args,options)=>{call={bin,args,options};const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{queueMicrotask(()=>child.emit('close',1));};child.stdin.on('finish',()=>{queueMicrotask(()=>{child.stdout.end(JSON.stringify(args.includes('auth')&&args.includes('status')&&!('loggedIn' in result)?{loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'}:result));child.emit('close',args.includes('auth')?0:exitCode);});});return child;};return {spawnProcess,call:()=>call};}
test('Claude teaching is isolated, subscription-only and returns native usage',async()=>{
 const f=fake({type:'result',result:'{"tool":"stay_silent"}',usage:{input_tokens:20,output_tokens:5,cache_read_input_tokens:10}});
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty-worker',executable:'/fake/claude',spawnProcess:f.spawnProcess,env:{PATH:'/bin',ANTHROPIC_API_KEY:'PRIVATE',ANTHROPIC_BASE_URL:'PRIVATE',CLAUDE_CODE_USE_BEDROCK:'1',CLAUDECODE:'1'}});
 const value=await gateway.generate({parentSessionId:'main',model:{providerID:'claude',modelID:'default'},prompt:'Fixture',onPrepared:async()=>{}});
 assert.equal(value.usage.input,30);assert.equal(value.usage.inputIncludesCache,true);assert.equal(value.usage.output,5);
 const {args,options}=f.call();assert.ok(args.includes('--safe-mode'));assert.ok(args.includes('--no-session-persistence'));assert.equal(args[args.indexOf('--tools')+1],'');assert.ok(args.includes('--strict-mcp-config'));assert.ok(!args.includes('--bare'));assert.ok(!args.includes('--resume'));assert.deepEqual(options.env,{PATH:'/bin'});assert.equal(options.cwd,'/owned/empty-worker');
});
test('Claude refuses API billing even when the native CLI reports logged in',async()=>{
 for(const auth of [{loggedIn:true,authMethod:'api_key',apiProvider:'firstParty'},{loggedIn:false,authMethod:'none'},{loggedIn:true,authMethod:'third_party',apiProvider:'bedrock'}]){
 const f=fake(auth);const gateway=new ClaudeLearningGateway({directory:'/tmp',executable:'/fake',spawnProcess:f.spawnProcess});await assert.rejects(gateway.authenticate(),/subscription/);
 }
 const f=fake({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'});assert.equal((await new ClaudeLearningGateway({directory:'/tmp',executable:'/fake',spawnProcess:f.spawnProcess}).authenticate()).type,'claude-subscription');
});
test('Claude hook normalization uses bounded public evidence and rejects secrets/thinking',()=>{
 assert.deepEqual(normalizeClaudeEvent({id:'x',sessionId:'s',kind:'thinking',text:'PRIVATE'}),[]);
 assert.deepEqual(normalizeClaudeEvent({id:'x',sessionId:'s',kind:'file',path:'/repo/.env',content:'PRIVATE'}),[]);
 assert.deepEqual(normalizeClaudeEvent({id:'x',sessionId:'s',kind:'command',command:'cat auth.json',output:'PRIVATE'}),[]);
 const events=normalizeClaudeEvent({id:'x',sessionId:'s',kind:'file',path:'/repo/retry.ts',content:'retry'.repeat(5000)});assert.equal(events[0].type,'file.changed');assert.ok(events[0].data.content.length<=3200);
 assert.equal(normalizeClaudeEvent({id:'x',sessionId:'s',kind:'read',path:'/repo/package.json'})[0].data.path,'/repo/package.json');
 assert.deepEqual(claudeEnvironment({ANTHROPIC_AUTH_TOKEN:'private',PATH:'/bin'}),{PATH:'/bin'});
});

test('signed-out auth status exit1 is decoded as a connection requirement, never a generic model failure',async()=>{
 const f=fake({loggedIn:false,authMethod:'none'});const spawnProcess=(...args)=>{const child=f.spawnProcess(...args);const emit=child.emit.bind(child);child.emit=(event,...values)=>emit(event,...(event==='close'?[1]:values));return child;};
 const gateway=new ClaudeLearningGateway({directory:'/tmp',executable:'/fake',spawnProcess});
 await assert.rejects(gateway.authenticate(),error=>error.code==='CLAUDE_SUBSCRIPTION_REQUIRED'&&/subscription/.test(error.message));
});

test('shared runtime accounts Claude cached input exactly once',async()=>{
 const {LearningEngine}=await import('../../../packages/runtime/src/learning-engine.js');
 const f=fake({type:'result',structured_output:{tool:'stay_silent',input:{reason:'No useful lesson in this synthetic fixture'},reason:'Synthetic test'},result:JSON.stringify({tool:'stay_silent',input:{reason:'No useful lesson in this synthetic fixture'},reason:'Synthetic test'}),usage:{input_tokens:2,output_tokens:5,cache_read_input_tokens:10,cache_creation_input_tokens:18}});
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty-worker',executable:'/fake/claude',spawnProcess:f.spawnProcess});
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway,defaultLearningModel:{providerID:'claude',modelID:'opus'},debounceMs:300000,capabilities:{host:'claude',observation:{kinds:['task.submitted']},surface:{experiments:false},model:{independent:true}}});
 try{await engine.load();await engine.command({action:'enable'});await engine.onWorkEvent({id:'synthetic-task',sessionId:'synthetic-chat',type:'task.submitted',data:{text:'Explain a cache snapshot'}});await engine.command({action:'suggest',sessionID:'synthetic-chat'});assert.equal(engine.state.usage.calls,1);assert.equal(engine.state.usage.input,30);assert.equal(engine.state.usage.measuredInput,30);}finally{await engine.command({action:'stop'});}
});

test('Claude orchestrator uses structured output rather than parsing prose or multiple JSON objects',async()=>{
 const call={tool:'stay_silent',input:{reason:'No useful context'},reason:'No useful context'};
 const f=fake({type:'result',result:'{"invalid":true} extra prose',structured_output:call,usage:{input_tokens:25,output_tokens:10}});
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:f.spawnProcess});
 const result=await gateway.generate({role:'orchestrator',model:{providerID:'claude',modelID:'default'},prompt:'Fixture',onPrepared:async()=>{}});
 assert.deepEqual(JSON.parse(result.text),call);const args=f.call().args;assert(args.includes('--json-schema'));assert.equal(JSON.parse(args[args.indexOf('--json-schema')+1]).additionalProperties,false);
 const missing=fake({type:'result',result:JSON.stringify(call),usage:{input_tokens:20,output_tokens:5}});
 const incomplete=await new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:missing.spawnProcess}).generate({role:'orchestrator',model:{providerID:'claude',modelID:'default'},prompt:'Fixture',onPrepared:async()=>{}});assert.match(incomplete.executionError.message,/structured/i);
});


test('Claude allows bounded structured-output completion and keeps work tools disabled',async()=>{
 const f=fake({type:'result',structured_output:{ok:true},usage:{input_tokens:3,output_tokens:4}});
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:f.spawnProcess});
 await gateway.generate({role:'orchestrator',model:{providerID:'claude',modelID:'haiku'},prompt:'Fixture',responseSchema:{type:'object'},onPrepared:async()=>{}});
 let args=f.call().args;
 assert.equal(args[args.indexOf('--max-turns')+1],'3');
 assert.match(args[args.indexOf('--system-prompt')+1],/structured-output formatter/);
 assert.equal(args[args.indexOf('--tools')+1],'');
 assert.equal(args[args.indexOf('--mcp-config')+1],'{"mcpServers":{}}');
 const plain=fake({type:'result',result:'Plain artifact',usage:{input_tokens:3,output_tokens:4}});
 await new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:plain.spawnProcess}).generate({role:'content-builder',model:{providerID:'claude',modelID:'haiku'},prompt:'Fixture',onPrepared:async()=>{}});
 args=plain.call().args;assert.equal(args[args.indexOf('--max-turns')+1],'1');
});

test('Claude reports formatter exhaustion accurately and recovers measured failed-call usage without private errors',async()=>{
 const f=fake({type:'result',subtype:'error_max_turns',is_error:true,errors:['PRIVATE configuration'],usage:{input_tokens:20,output_tokens:7,cache_read_input_tokens:5,cache_creation_input_tokens:10}},1);
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:f.spawnProcess});let id;
 const failed=await gateway.generate({role:'orchestrator',model:{providerID:'claude',modelID:'haiku'},prompt:'Fixture',onPrepared:async value=>{id=value;}});assert.equal(failed.executionError.code,'CLAUDE_FORMAT_LIMIT');assert.doesNotMatch(failed.executionError.message,/PRIVATE|sign-in/);assert.equal(failed.usage.input,35);
 assert.deepEqual(await gateway.recoverUsage(id),{input:35,output:7,inputIncludesCache:true,cache:{read:5,write:10}});
});


test('failed Claude formatting settles measured runtime tokens once and still fails the step',async()=>{
 const {LearningEngine}=await import('../../../packages/runtime/src/learning-engine.js');
 const f=fake({type:'result',subtype:'error_max_turns',is_error:true,usage:{input_tokens:20,output_tokens:7,cache_read_input_tokens:5}},1);
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:f.spawnProcess});const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway,defaultLearningModel:{providerID:'claude',modelID:'haiku'},capabilities:{host:'claude',model:{independent:true},surface:{},observation:{kinds:[]}}});
 await engine.load();await engine.command({action:'enable'});
 await assert.rejects(engine.generateStep({role:'orchestrator',intent:'moment',parentSessionId:'failed',model:{providerID:'claude',modelID:'haiku'},prompt:'Fixture'}),error=>error.code==='CLAUDE_FORMAT_LIMIT');
 assert.equal(engine.session('failed').usage.input,25);assert.equal(engine.state.usage.output,7);assert.equal(engine.state.usage.calls,1);assert.equal(engine.state.usage.unreportedCalls??0,0);
 await engine.reconcilePending();assert.equal(engine.state.usage.calls,1);gateway.close();
});


test('an explicitly measured zero-token Claude failure is not replaced by a prompt estimate',async()=>{
 const {LearningEngine}=await import('../../../packages/runtime/src/learning-engine.js');
 const f=fake({type:'result',subtype:'error_max_turns',is_error:true,usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}},1);
 const gateway=new ClaudeLearningGateway({directory:'/owned/empty',executable:'/fake',spawnProcess:f.spawnProcess});const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway,capabilities:{host:'claude',model:{independent:true},surface:{},observation:{kinds:[]}}});await engine.load();await engine.command({action:'enable'});
 await assert.rejects(engine.generateStep({role:'orchestrator',intent:'moment',parentSessionId:'zero',model:{providerID:'claude',modelID:'haiku'},prompt:'Synthetic diagnostic'}),error=>error.code==='CLAUDE_FORMAT_LIMIT');
 assert.equal(engine.state.usage.input,0);assert.equal(engine.state.usage.output,0);assert.equal(engine.state.usage.calls,1);assert.equal(engine.state.usage.estimatedInput??0,0);assert.equal(engine.state.usage.unreportedCalls??0,0);gateway.close();
});
