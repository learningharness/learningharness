import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, readlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { learnerStore } from '../../learning/src/learner-store.js';
const profile={goals:['Crash recovery'],known:[],preferences:''};
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'dd-learner-lock-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function deadPid(){const child=spawn(process.execPath,['-e','']);await once(child,'exit');return child.pid;}
test('a crashed owner is recovered without losing saved learner data',async t=>{
 const dir=await fixture(t),store=learnerStore(dir);await store.saveProfile(profile);
 await symlink(`learningharness:${await deadPid()}:abandoned`,join(dir,'learner.lock'));
 await store.noteExploration('codex',{objective:'Recovery',path:[]});
 assert.deepEqual((await store.read()).profile.goals,profile.goals);
 assert.equal((await store.read()).explorations.length,1);
});
test('live owners are never stolen, even without an age limit',async t=>{
 const dir=await fixture(t),owner=`learningharness:${process.pid}:live`;
 await symlink(owner,join(dir,'learner.lock'));
 await assert.rejects(learnerStore(dir).saveProfile(profile),/busy/);
 assert.equal(await readlink(join(dir,'learner.lock')),owner);
});
test('unknown empty legacy locks fail closed with actionable recovery guidance',async t=>{
 const dir=await fixture(t);await writeFile(join(dir,'learner.lock'),'');
 await assert.rejects(learnerStore(dir).saveProfile(profile),/legacy.*stop.*remove.*learner\.lock/i);
 assert.equal(await readFile(join(dir,'learner.lock'),'utf8'),'');
});
test('simultaneous processes safely recover one dead owner and merge every mutation',async t=>{
 const dir=await fixture(t),pid=await deadPid();
 await symlink(`learningharness:${pid}:abandoned`,join(dir,'learner.lock'));
 const moduleURL=new URL('../../learning/src/learner-store.js',import.meta.url).href;
 const children=Array.from({length:6},(_,i)=>spawn(process.execPath,['--input-type=module','-e',`import {learnerStore} from ${JSON.stringify(moduleURL)};await learnerStore(${JSON.stringify(dir)}).noteExploration('worker',{objective:${JSON.stringify('topic-'+i)},path:[]});`],{stdio:['ignore','ignore','pipe']}));
 await Promise.all(children.map(async child=>{let error='';child.stderr.on('data',data=>{error+=data;});const [code]=await once(child,'exit');assert.equal(code,0,error);}));
 assert.equal((await learnerStore(dir).read()).explorations.length,6);
});
test('SIGKILL during a real mutation leaves atomic ownership that the next writer recovers',async t=>{
 const dir=await fixture(t),store=learnerStore(dir);await store.saveProfile(profile);
 const moduleURL=new URL('../../learning/src/learner-store.js',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`import {learnerStore} from ${JSON.stringify(moduleURL)};await learnerStore(${JSON.stringify(dir)}).noteExploration('worker',{get objective(){process.kill(process.pid,'SIGKILL');return 'never saved';},path:[]});`],{stdio:'ignore'});
 const [,signal]=await once(child,'exit');assert.equal(signal,'SIGKILL');
 assert.match(await readlink(join(dir,'learner.lock')),new RegExp('^learningharness:'+child.pid+':'));
 await store.noteExploration('codex',{objective:'After crash',path:[]});
 const saved=await store.read();assert.deepEqual(saved.profile.goals,profile.goals);
 assert.deepEqual(saved.explorations.map(item=>item.objective),['After crash']);
});
test('a crash before choosing a ticket cannot strand later writers',async t=>{
 const dir=await fixture(t),pid=await deadPid();
 await symlink('choosing',join(dir,`.learner-writer-${pid}-00000000-0000-0000-0000-000000000000`));
 await learnerStore(dir).saveProfile(profile);
 assert.deepEqual((await learnerStore(dir).read()).profile.goals,profile.goals);
});
