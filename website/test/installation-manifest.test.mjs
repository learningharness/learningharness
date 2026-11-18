import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {installationManifest} from '../installation-manifest.mjs';
test('withheld release publishes no executable artifacts and needs no downloads',async()=>{
 const result=await installationManifest({approved:false,directory:new URL('file:///nonexistent/')});
 assert.equal(result.status,'unreleased');assert.deepEqual(result.artifacts,[]);
});
test('available release requires all package bytes to match published checksums',async()=>{
 const root=await mkdtemp(join(tmpdir(),'dontdumb-install-manifest-'));
 try{
  await mkdir(join(root,'downloads'));
  const names=['learning-harness-codex-1.0.0-beta.27','learning-harness-claude-1.0.0-beta.28'];
  const checksums=[];
  for(const name of names){const bytes=Buffer.from('fixture '+name);await writeFile(join(root,'downloads',name+'.zip'),bytes);checksums.push(createHash('sha256').update(bytes).digest('hex')+'  '+name+'.zip');}
  await writeFile(join(root,'downloads/SHA256SUMS.txt'),checksums.join('\n')+'\n');
  const options={approved:true,directory:pathToFileURL(root+'/'),release:{artifact:{file:names[0]+'.zip',sha256:checksums[0].slice(0,64)},candidateArtifacts:[{host:'claude',file:names[1]+'.zip',version:'1.0.0-beta.28',sha256:checksums[1].slice(0,64)}]}};
  const result=await installationManifest(options);
  assert.equal(result.status,'available');assert.equal(result.artifacts.length,2);
  assert.deepEqual(result.artifacts.map(a=>a.host),['codex','claude']);
  assert.equal(result.artifacts[0].version,'1.0.0-beta.27');assert.equal(result.artifacts[1].version,'1.0.0-beta.28');assert.equal(result.artifacts[1].sharedFeatureBaseline,'1.0.0-beta.27');
  const claude=result.artifacts.find(a=>a.host==='claude');assert.equal(claude.channel,'release-candidate');assert.equal(claude.nativeAcceptance,'pending');assert.match(claude.requirements.join(' '),/CLI.*subscription/);
  for(const artifact of result.artifacts)assert.match(artifact.sha256,/^[a-f0-9]{64}$/);
  await writeFile(join(root,'downloads',names[0]+'.zip'),'changed after checksumming');
  await assert.rejects(installationManifest(options),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
