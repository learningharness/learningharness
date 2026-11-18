import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';
import {resetLearningHarness,stopLegacyWriter} from './reset-learning-harness.mjs';
import {spawn} from 'node:child_process';
test('reset stops only a verified legacy learning writer; unrelated live PIDs are rejected',async()=>{
 const home=await mkdtemp(join(tmpdir(),'lh-reset-'));let child;
 try{
  const script=join(home,'.local/share/dontdumb/plugins/0.1.0-beta.17/lib/server.mjs');await mkdir(dirname(script),{recursive:true});await writeFile(script,'setInterval(()=>{},1000);');
  child=spawn(process.execPath,[script],{stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  const root=join(home,'.local/share/dontdumb/codex');await mkdir(root,{recursive:true});await writeFile(join(root,'writer.lock'),String(child.pid));await writeFile(join(root,'state.json'),'keep in backup');
  assert.equal(await stopLegacyWriter(process.pid,{home}),false);
  const result=await resetLearningHarness({home,stopLegacyWriters:true});assert.ok(result.moved>0);assert.equal(child.exitCode!==null||child.signalCode!==null,true);
  assert.equal(await readFile(join(result.backup,'legacy/codex/state.json'),'utf8'),'keep in backup');
 }finally{child?.kill();await rm(home,{recursive:true,force:true});}
});
test('clean slate backs up current and legacy imports while retaining installation, analytics and other-host files',async()=>{
 const home=await mkdtemp(join(tmpdir(),'lh-reset-'));
 const put=async(path,text)=>{const p=join(home,'.local/share',path);await mkdir(dirname(p),{recursive:true});await writeFile(p,text);};
 try{
  const cleared=['learning-harness/codex/state.json','learning-harness/codex/core/state.json','learning-harness/learner/learner.json','dontdumb/learner.json','dontdumb/native-preview/state.json','dontdumb/native-preview/core/state.json','dontdumb/codex/state.json'];
  const kept=['learning-harness/install/codex/plugin.json','learning-harness/analytics.json','learning-harness/analytics-identity.json','dontdumb/native-preview/claude/state.json'];
  for(const p of [...cleared,...kept])await put(p,p);
  const result=await resetLearningHarness({home});assert.ok(result.moved>0);
  for(const p of cleared)await assert.rejects(access(join(home,'.local/share',p)));
  for(const p of kept)assert.equal(await readFile(join(home,'.local/share',p),'utf8'),p);
  assert.equal(await readFile(join(result.backup,'current/learner/learner.json'),'utf8'),'learning-harness/learner/learner.json');
  assert.equal((await resetLearningHarness({home})).moved,0);
 }finally{await rm(home,{recursive:true,force:true});}
});
test('a live writer blocks reset before any memory is moved',async()=>{
 const home=await mkdtemp(join(tmpdir(),'lh-reset-'));const core=join(home,'.local/share/learning-harness/codex/core');
 try{await mkdir(core,{recursive:true});await writeFile(join(core,'writer.lock'),String(process.pid));await writeFile(join(core,'state.json'),'keep');await assert.rejects(resetLearningHarness({home}),/still running/);assert.equal(await readFile(join(core,'state.json'),'utf8'),'keep');}
 finally{await rm(home,{recursive:true,force:true});}
});

test('both-host reset archives Claude state and legacy imports, preserving packages and credentials',async t=>{
 const home=await mkdtemp(join(tmpdir(),'lh-reset-both-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const put=async path=>{const file=join(home,'.local/share',path);await mkdir(dirname(file),{recursive:true});await writeFile(file,path);};
 const cleared=['learning-harness/codex/state.json','learning-harness/claude-candidate/learner/learner.json','learning-harness/claude/core/state.json','learning-harness/learner/learner.json','dontdumb/claude/state.json','dontdumb/native-preview/claude/state.json'];
 const kept=['learning-harness/claude-native-candidate/1.0.0-beta.50/plugin/server.mjs','learning-harness/install/codex/plugin.json','learning-harness/analytics.json'];
 for(const path of [...cleared,...kept])await put(path);
 const result=await resetLearningHarness({home,hosts:['codex','claude']});
 for(const path of cleared)await assert.rejects(access(join(home,'.local/share',path)));
 for(const path of kept)assert.equal(await readFile(join(home,'.local/share',path),'utf8'),path);
 const map=JSON.parse(await readFile(join(result.backup,'restore-map.json'),'utf8'));
 for(const move of map.moves)assert.ok(await readFile(move.destination).catch(async()=>{await access(move.destination);return true;}));
 assert.equal((await resetLearningHarness({home,hosts:['codex','claude']})).moved,0);
});

test('Claude live writer blocks both-host reset before either host memory moves',async t=>{
 const home=await mkdtemp(join(tmpdir(),'lh-reset-both-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const codex=join(home,'.local/share/learning-harness/codex/state.json'),core=join(home,'.local/share/learning-harness/claude-candidate/core');
 await mkdir(dirname(codex),{recursive:true});await writeFile(codex,'preserve');await mkdir(core,{recursive:true});await writeFile(join(core,'writer.lock'),String(process.pid));
 await assert.rejects(resetLearningHarness({home,hosts:['codex','claude']}),/still running/);
 assert.equal(await readFile(codex,'utf8'),'preserve');
});
