import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {releaseManifest} from './manifest.mjs';
import {publishRelease} from './publish.mjs';
const commit='a'.repeat(40),version='1.0.0-beta.1001';
async function fixture(run){
 const directory=await mkdtemp(join(tmpdir(),'lh-publish-test-'));
 try{
  const artifacts=['codex','claude'].map(host=>({host,file:`learning-harness-${host}-${version}.zip`,sha256:createHash('sha256').update(host).digest('hex')}));
  for(const a of artifacts)await writeFile(join(directory,a.file),a.host);
  await writeFile(join(directory,'install.json'),JSON.stringify(releaseManifest({version,commit,artifacts})));
  for(const file of ['install.md','SHA256SUMS.txt','RELEASE_NOTES.md'])await writeFile(join(directory,file),'fixture');
  await run(directory);
 }finally{await rm(directory,{recursive:true,force:true});}
}
function mock({fail=false,existing=false,stale=false}={}){
 const calls=[];let created=existing;
 const gh=args=>{
  calls.push(args);
  if(args[0]==='api'&&args[1].endsWith('branches/main'))return stale?'b'.repeat(40):commit;
  if(args[0]==='api'){const error=Error('published releases only');error.stderr='HTTP 404';throw error;}
  if(args[0]==='release'&&args[1]==='view'){
   if(!created){const error=Error('missing');error.stderr='release not found';throw error;}
   return JSON.stringify({isDraft:true,targetCommitish:commit,assets:existing?[{name:`learning-harness-codex-${version}.zip`}]:[]});
  }
  if(args[1]==='create')created=true;
  if(args[1]==='upload'&&fail)throw Error('upload failed');
  if(args[1]==='download')writeFileSync(join(args[args.indexOf('--dir')+1],args[args.indexOf('--pattern')+1]),'different bytes');
  return '';
 };return {calls,gh};
}
test('publishes only after every asset has uploaded to a draft',()=>fixture(async directory=>{
 const {gh,calls}=mock();await publishRelease({directory,gh});
 assert(calls.find(a=>a[1]==='create').includes('--draft'));
 assert.equal(calls.filter(a=>a[1]==='upload').length,5);
 assert.equal(calls.at(-1)[1],'edit');assert(calls.at(-1).includes('--latest'));
}));
test('failed uploads leave latest untouched',()=>fixture(async directory=>{
 const {gh,calls}=mock({fail:true});await assert.rejects(publishRelease({directory,gh}),/upload failed/);assert(!calls.some(a=>a[1]==='edit'));
}));
test('retries refuse to overwrite previously uploaded different bytes',()=>fixture(async directory=>{
 const {gh,calls}=mock({existing:true});await assert.rejects(publishRelease({directory,gh}),/asset differs/);assert(!calls.some(a=>['upload','edit'].includes(a[1])));
}));
test('superseded main and archive corruption cannot publish',()=>fixture(async directory=>{
 const stale=mock({stale:true});await assert.rejects(publishRelease({directory,gh:stale.gh}),/newer main/);assert.equal(stale.calls.length,1);
 await writeFile(join(directory,`learning-harness-codex-${version}.zip`),'tampered');
 const fresh=mock();await assert.rejects(publishRelease({directory,gh:fresh.gh}),/checksum/);assert.equal(fresh.calls.length,0);
}));
