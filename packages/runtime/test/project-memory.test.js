import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {learnerStore} from '../../learning/src/learner-store.js';import {sessionContext} from '../../learning/src/opening-context.js';import {learnerContext} from '../../learning/src/learner-context.js';import {selectReview} from '../../learning/src/review-ledger.js';
test('project identity distinguishes same-name folders and carries earlier work into a new chat',async()=>{
 const a=sessionContext({project:'/work/first/app',title:'Authentication'}),b=sessionContext({project:'/work/second/app',title:'Authentication'});assert.notEqual(a.projectKey,b.projectKey);
 const dir=await mkdtemp(join(tmpdir(),'lh-project-'));
 try{const store=learnerStore(dir);await store.noteProjectWork('codex',{...a,sessionId:'old-chat',taskId:'auth-task',task:'Build the authentication page with a session cookie.',at:'2026-01-01T00:00:00Z'});
 const data=await learnerStore(dir).read();const next=learnerContext(data,'Build account settings',null,{...a,title:'Account settings'});assert.equal(next.project.priorWork[0].task,'Build the authentication page with a session cookie.');assert.equal(next.project.priorWork[0].sessionId,'old-chat');assert.deepEqual(learnerContext(data,'Build account settings',null,b).project.priorWork,[]);
 const importedDir=await mkdtemp(join(tmpdir(),'lh-project-import-'));const restored=learnerStore(importedDir);try{await restored.import(await store.export());assert.equal((await restored.read()).workContexts.length,1);}finally{await rm(importedDir,{recursive:true,force:true});}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('due review follows its project across chats and labels project relevance honestly',()=>{
 const a=sessionContext({project:'/work/first/app'}),b=sessionContext({project:'/work/second/app'});const data={evidence:[{id:'a',momentId:'a',objective:'Cookie scope',project:a.project,projectKey:a.projectKey,verdict:'correct',createdAt:'2026-01-01T00:00:00Z'}]};
 assert.equal(selectReview(data,{...a,task:'Build account preferences'},'2026-01-04T00:00:00Z').relevance,'project');assert.equal(selectReview(data,{...b,task:'Build account preferences'},'2026-01-04T00:00:00Z'),null);
});
test('observed project task context survives engine restart and is supplied to the next chat',async()=>{
 const {LearningEngine}=await import('../src/learning-engine.js');const dir=await mkdtemp(join(tmpdir(),'lh-project-engine-'));const inputs=[];
 const opts={storage:{get:async()=>null,set:async()=>{}},learnerStore:learnerStore(dir),defaultLearningModel:{providerID:'fixture',modelID:'fixture'},debounceMs:60000,proactiveFollowup:true,capabilities:{host:'fixture',observation:{kinds:['task.submitted']},surface:{experiments:false},model:{independent:true}},gateway:{generate:async input=>{inputs.push(input.prompt);return {text:JSON.stringify({tool:'stay_silent',input:{reason:'No new useful intervention'},reason:'Keep work moving'}),usage:{input:10,output:10}}}}};
 const first=new LearningEngine(opts),next=new LearningEngine(opts);
 try{await first.load();await first.command({action:'enable'});await first.openSession('auth',{project:'/work/auth-app',title:'Login page'});await first.onWorkEvent({id:'auth-task',sessionId:'auth',type:'task.submitted',data:{text:'Build a login page using an HttpOnly session cookie.'}});
 await next.load();await next.command({action:'enable'});await next.openSession('account',{project:'/work/auth-app',title:'Account settings'});await next.onWorkEvent({id:'account-task',sessionId:'account',type:'task.submitted',data:{text:'Build account settings and sign-out behavior.'}});await next.command({action:'suggest',sessionID:'account'});
 assert.ok(inputs.at(-1).includes('Build a login page using an HttpOnly session cookie.'));assert.equal((await learnerStore(dir).read()).workContexts.length,2);
 }finally{for(const e of [first,next])for(const t of e.parallelTimers.values())clearTimeout(t);await rm(dir,{recursive:true,force:true});}
});
