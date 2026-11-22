import test from 'node:test';import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,readdir,rm,cp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const exec=promisify(execFile),packageDir=resolve(process.env.LH_CLAUDE_PACKAGE_DIR??'artifacts/claude-native-candidate');
const chat='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
async function hook(root,env,event){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'hook.mjs')],{env,stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.on('error',reject);child.on('close',code=>code?reject(Error('hook failed')):resolve(output.trim()?JSON.parse(output):null));child.stdin.end(JSON.stringify(event));});}
function rpc(root,env){const child=spawn(process.execPath,[join(root,'server.mjs')],{env,stdio:['pipe','pipe','pipe']});let seq=0,text='';const requests=new Map();child.stdout.on('data',chunk=>{text+=chunk;let index;while((index=text.indexOf('\n'))>=0){const reply=JSON.parse(text.slice(0,index));text=text.slice(index+1);requests.get(reply.id)?.(reply);requests.delete(reply.id);}});return {child,call:(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('RPC timeout')),5000);requests.set(id,reply=>{clearTimeout(timer);resolve(reply);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');})};}
test('relocated native package binds two chats through hooks, needs no pasted ID, captures nothing Off',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'lh-claude-package-'));t.after(()=>rm(temp,{recursive:true,force:true}));const root=join(temp,'relocated');await cp(packageDir,root,{recursive:true});
 const data=join(temp,'private'),env={...process.env,LEARNING_HARNESS_DATA_DIR:data,DONTDUMB_LEARNER_DIR:join(temp,'learner'),DONTDUMB_NATIVE_TEST_NO_SERVICE:'1'};
 const start=await hook(root,env,{hook_event_name:'SessionStart',source:'startup',session_id:chat,cwd:'/synthetic/project',prompt:'MUST_NOT_CAPTURE'});
 const token=start.hookSpecificOutput.additionalContext.match(/chatBinding "([a-f0-9]{64})"/)[1];
 assert(!/show_learning_launcher|show_startup_invitation/.test(start.hookSpecificOutput.additionalContext));
 assert(!JSON.stringify(start).includes('MUST_NOT_CAPTURE'));assert(!JSON.stringify(start).includes('permissionDecision'));
 await writeFile(join(data,'state.json'),JSON.stringify({on:true}));
 const second=await hook(root,env,{hook_event_name:'SessionStart',source:'startup',session_id:other,cwd:'/synthetic/other'});const token2=second.hookSpecificOutput.additionalContext.match(/chatBinding "([a-f0-9]{64})"/)[1];assert.notEqual(token,token2);
 await writeFile(join(data,'state.json'),JSON.stringify({on:false}));
 const repeated=await hook(root,env,{hook_event_name:'SessionStart',source:'resume',session_id:chat,cwd:'/synthetic/project'});assert(!repeated.hookSpecificOutput.additionalContext.includes('show_learning_launcher'));
 await hook(root,env,{hook_event_name:'UserPromptSubmit',session_id:chat,cwd:'/synthetic/project',prompt:'MUST_NOT_CAPTURE'});
 await assert.rejects(readdir(join(data,'events')),{code:'ENOENT'});
 const server=rpc(root,env);t.after(()=>server.child.kill());
 const tools=(await server.call('tools/list')).result.tools;const enabledResource=(await server.call('resources/read',{uri:tools.find(t=>t.name==='turn_learning_on')._meta.ui.resourceUri})).result.contents[0];assert.match(enabledResource.text,/data-enable-open="true"/);assert.equal(tools.find(t=>t.name==='turn_learning_off')._meta,undefined);assert(tools.find(x=>x.name==='open_learn').inputSchema.properties.chatBinding);assert(!JSON.stringify(tools).includes('openai/'));
 assert((await server.call('tools/call',{name:'open_learn',arguments:{}})).error);
 assert((await server.call('tools/call',{name:'open_learn',arguments:{chatBinding:'a'.repeat(64)}})).error);
 assert((await server.call('tools/call',{name:'open_learn',arguments:{chatBinding:token},_meta:{session_id:other}})).error);
 const listedAgain=(await server.call('tools/list')).result.tools;assert.equal(listedAgain.filter(t=>t.name==='show_learning_launcher').length,1);
 assert(tools.some(t=>t.name==='show_learning_launcher'));
 await writeFile(join(data,'state.json'),JSON.stringify({on:false,showSessionLauncher:true}));
 for(const session of [chat,other])await writeFile(join(data,'launcher-'+session+'.requested'),'legacy-fixture');
 for(const value of [token,token2]){const launched=await server.call('tools/call',{name:'show_learning_launcher',arguments:{chatBinding:value}});assert.equal(launched.result.structuredContent.first,true);assert.equal(launched.result.structuredContent.chatBinding,value);const again=await server.call('tools/call',{name:'show_learning_launcher',arguments:{chatBinding:value}});assert(again.error);assert.equal(again.result,undefined);assert.equal(launched.result.structuredContent.view,'learn');}
 assert((await server.call('tools/call',{name:'show_learning_launcher',arguments:{chatBinding:token},_meta:{session_id:other}})).error);
 await writeFile(join(data,'state.json'),JSON.stringify({on:false,showSessionLauncher:false}));
 assert((await server.call('tools/call',{name:'show_learning_launcher',arguments:{chatBinding:token}})).error);
 for(const value of [token,token2]){const result=await server.call('tools/call',{name:'open_learn',arguments:{chatBinding:value}});assert.equal(result.result.structuredContent.chatBinding,value);assert.equal(result.result.structuredContent.view,'learn');}
 const uri=tools.find(x=>x.name==='open_learn')._meta.ui.resourceUri;
 const resource=(await server.call('resources/read',{uri})).result.contents[0];assert.match(resource.text,/<html\b[^>]*\blang="en"/);assert.match(resource.text,/<title>LearningHarness<\/title>/);assert(resource.text.includes('data-learning-host="claude"'));assert(resource.text.includes('data-claude-launcher="true"'));assert(resource.text.includes('active Claude subscription'));assert.equal(resource._meta.ui.preferredDisplayMode,'fullscreen');assert(!resource.text.includes('Use Claude’s expand button above this card'));assert(!resource.text.includes('<span>Open LearningHarness ↗</span>'));assert(resource.text.includes('availableDisplayModes'));assert(resource.text.includes('to open Learn.'));
 const invitation=(await server.call('resources/read',{uri:tools.find(t=>t.name==='show_ready_invitation')._meta.ui.resourceUri})).result.contents[0];assert.notEqual(invitation._meta?.ui?.preferredDisplayMode,'fullscreen');assert.match(tools.find(t=>t.name==='show_ready_invitation')._meta.ui.resourceUri,/claude\/1\.0\.0-beta\./);assert.match(invitation.text,/data-plugin-version="1\.0\.0-beta\./);
 const command=await readFile(join(root,'commands/learn.md'),'utf8');assert.match(command,/open_learn/);assert.match(command,/Do not submit another prompt/);assert(!JSON.stringify(resource._meta??{}).includes('openai/'));
 const readme=await readFile(join(root,'START_HERE.md'),'utf8');assert.match(readme,/Installation agents must tell the user/);assert.match(readme,/does not collect your password/);
 const config=JSON.parse(await readFile(join(root,'.claude-plugin/plugin.json'),'utf8'));assert.match(config.description,/CLI signed in with an active Claude subscription/);
 server.child.stdin.end();await new Promise(r=>server.child.once('exit',r));
});

test('directory package includes publisher, square listing icon, README and existing evaluation license',async()=>{
 const manifest=JSON.parse(await readFile(join(packageDir,'.claude-plugin/plugin.json'),'utf8'));
 const marketplace=JSON.parse(await readFile(join(packageDir,'.claude-plugin/marketplace.json'),'utf8'));assert.equal(marketplace.name,'learningharness-claude-candidate');assert.equal(marketplace.plugins[0].source,'./');
 assert.equal(manifest.author.name,'LearningHarness');assert.equal(manifest.displayName,'LearningHarness');assert.equal(manifest.homepage,'https://learningharness.dev');assert.match(manifest.repository,/^https:\/\/github.com\//);
 const png=await readFile(join(packageDir,manifest.icon));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);assert(png.length<2_000_000);
 const readme=await readFile(join(packageDir,'README.md'),'utf8');assert(readme.split(/\s+/).length>=40);assert.match(readme,/active Claude subscription/);
 assert.equal(await readFile(join(packageDir,'LICENSE'),'utf8'),await readFile('LICENSE','utf8'));
});

test('bundled installer finds its own relocated source and rewrites the local node path',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'lh-claude-self-install-'));t.after(()=>rm(temp,{recursive:true,force:true}));const root=join(temp,'source');await cp(packageDir,root,{recursive:true});
 const module=await import('file://'+join(root,'install.mjs'));const result=await module.installCandidate({home:join(temp,'new-user'),node:'/synthetic/node with spaces',run:async(_cli,args)=>args[1]==='list'?{stdout:JSON.stringify([{id:'learningharness@learningharness-claude-candidate',version:JSON.parse(await readFile(join(root,'candidate.json'),'utf8')).version,enabled:true,installPath:root}])}:({})});
 assert.equal(JSON.parse(await readFile(join(result.plugin,'candidate.json'),'utf8')).version,JSON.parse(await readFile(join(root,'candidate.json'),'utf8')).version);
 const hooks=JSON.parse(await readFile(join(result.plugin,'hooks/hooks.json'),'utf8'));assert.match(hooks.hooks.SessionStart[0].hooks[0].command,/'\/synthetic\/node with spaces'/);
});
