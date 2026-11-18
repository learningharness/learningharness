import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {userDataRoot,migrateLocalDirectory} from '../src/user-data.js';
test('new data root uses LearningHarness',()=>assert.equal(userDataRoot('/fixture'),'/fixture/.local/share/learning-harness'));
test('migration preserves data and conflicting destinations, skips runtime files and is repeatable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-migrate-'));const old=join(root,'old'),next=join(root,'new');await mkdir(old);await mkdir(next);
 try{
  await writeFile(join(old,'state.json'),'old');await writeFile(join(next,'state.json'),'current');await mkdir(join(old,'sessions'));await writeFile(join(old,'sessions/a.json'),'history');await writeFile(join(old,'companion.json'),'stale endpoint');await symlink('/does-not-exist',join(old,'link'));
  await migrateLocalDirectory(old,next);await migrateLocalDirectory(old,next);
  assert.equal(await readFile(join(next,'state.json'),'utf8'),'current');assert.equal(await readFile(join(next,'sessions/a.json'),'utf8'),'history');
  assert.equal(await readFile(join(next,'migration-backup/state.json'),'utf8'),'old');assert.equal(await readFile(join(old,'state.json'),'utf8'),'old');
  await assert.rejects(readFile(join(next,'companion.json')));await assert.rejects(readFile(join(next,'link')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('migration refuses a live writer rather than splitting its state',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-migrate-'));const old=join(root,'old');await mkdir(old);await writeFile(join(old,'writer.lock'),String(process.pid));
 try{await assert.rejects(migrateLocalDirectory(old,join(root,'new')),/Restart.*migration/);}finally{await rm(root,{recursive:true,force:true});}
});
