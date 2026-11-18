import {mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertPublicationReady} from './release-policy.mjs';
const release=JSON.parse(await readFile(new URL('./release-readiness.json',import.meta.url),'utf8'));
const filename=release.artifact.file;
// Keep the previously published URL available with its exact approved bytes.
const previous=[{file:"learning-harness-codex-1.0.0-beta.60.zip",sha256:"2fe210fd12764cd08afb2b2efd655c3a0a9437c20ab2465b75a4048a2d5fca41"},{file:"learning-harness-codex-1.0.0-beta.59.zip",sha256:"5a8d8dc1bdb85ceb1ee88340e068373cb000d6e436b0cea93694d50638baf3c0"},{file:"learning-harness-codex-1.0.0-beta.35.zip",sha256:"4d41caa0a3593ce438deee256e4a158688c522292b72520c22bbca65c2e3e7f0"},{file:"learning-harness-codex-1.0.0-beta.33.zip",sha256:"e5802dc580c6d07d28555e5276daa5b6fa5f07eb118bfe5a2c862754cf54b265"},{"file": "learning-harness-codex-1.0.0-beta.27.zip", "sha256": "cec6fb2c8b6ba58ec812ffdef295aaf33e0cd16acece9972e809e5470bb325a0"},{file:"learning-harness-codex-1.0.0-beta.23.zip",sha256:"5f840b5fd3394bd14405b44415cd4b4e45737d15adfcf75bd8aac0e77d6bf4ca"},{file:"learning-harness-codex-1.0.0-beta.22.zip",sha256:"6a2ff6af3222c0f87635efe26f8c268ffd0bb02750d354e4337262b74a18e356"},{file:"learning-harness-codex-1.0.0-beta.21.zip",sha256:"b362273ecabe0c36c987944faff597250f5372c3b47bbda2ec522c5dab301e9d"},{"file": "learning-harness-codex-1.0.0-beta.20.zip", "sha256": "67dd30a0921b705a51692489c51d6747c0440069e4741269198b0314f728c94f"},{"file": "learning-harness-codex-1.0.0-beta.19.zip", "sha256": "1ccbdfb5dd7ff6862470f3c524b8f9e311d8c74ba9f15ba38fcf43385c57cc66"},{file:'learning-harness-codex-1.0.0-beta.18.zip',sha256:'7e3d28a8d642d2abe39d207af38b01e4b793b824ce2e4096a948c15061a4e1d0'},{file:'learning-harness-codex-1.0.0-beta.17.zip',sha256:'3ab9585ba39722fec364d0667b95d1907846b68b1a4dfc9f3a42f40435938f63'},{file:'learning-harness-codex-1.0.0-beta.2.zip',sha256:'4b45df25b333a616281b369c7c5de529205afda468faf52776b3aecb0adde65a'},{file:'learning-harness-codex-0.1.0-beta.7.zip',sha256:'137e181fe89006e99f030e8c686aecb33d78123bcc9fc78c648261e700b9253c'},{file:'learning-harness-codex-0.1.0-beta.1.zip',sha256:'a46e41b90709355ccd39e07ee8a8d6127a65437a7873f3a7725af8324ff64f3b'}, {file:'learning-harness-codex-0.1.0-beta.2.zip',sha256:'1d6b8cb4b93161174a849b294e1ff5016ee208a49303665c21569c032e827ab7'}, {file:'learning-harness-codex-0.1.0-beta.3.zip',sha256:'edaea3242e9792fab9fbb8891ceb38959d876e8c5d29f8a5f693ed6d107eaa91'}, {file:'learning-harness-codex-0.1.0-beta.4.zip',sha256:'710be7236f49faf7ce318bc9653d9fb59fda4d9983681254f6c8932df3d22817'}, {file:'learning-harness-codex-0.1.0-beta.5.zip',sha256:'ce86c35c264b6ce446819a128bfa563ed9013e4f5719ca600e992ddf64190c35'}, {file:'learning-harness-codex-0.1.0-beta.6.zip',sha256:'6627ed321d630f1f3971ff7d51cabcd141036270ecce532bee34083f5e1972fc'}];
const source=new URL('../artifacts/codex-release/'+filename,import.meta.url);
const destination=new URL('./dist/downloads/',import.meta.url);
const candidate=JSON.parse(await readFile(new URL('../artifacts/codex-release/candidate.json',import.meta.url),'utf8'));
assertPublicationReady(release);
if(release.artifact?.file!==filename)throw Error('Unexpected approved Codex package.');
// Public downloads are pinned by approval, not a newer local staging receipt.
if(release.channel!=='public-beta'&&(candidate.host!=='codex'||candidate.file!==filename))throw Error('Stable Codex candidate does not match approved package.');
if(candidate.status!=='accepted'&&release.channel!=='public-beta')throw Error('Stable publication requires exact-package acceptance.');
const bytes=await readFile(source),sha=createHash('sha256').update(bytes).digest('hex');if((release.channel!=='public-beta'&&sha!==candidate.sha256)||sha!==release.artifact?.sha256||release.artifact?.file!==filename)throw Error('Candidate changed after acceptance.');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
await copyFile(source,new URL(filename,destination));
let sums=sha+'  '+filename+'\n';
for(const old of previous){
 if(old.file===filename)continue;
 const oldSource=new URL('../artifacts/codex-release/'+old.file,import.meta.url);
 if(createHash('sha256').update(await readFile(oldSource)).digest('hex')!==old.sha256)throw Error('Previously published archive changed.');
 await copyFile(oldSource,new URL(old.file,destination));
 sums+=old.sha256+'  '+old.file+'\n';
}
for(const extra of release.candidateArtifacts??[]){
 const record=JSON.parse(await readFile(new URL('../artifacts/'+extra.host+'-release/candidate.json',import.meta.url),'utf8'));
 const path=new URL('../artifacts/'+extra.host+'-release/'+extra.file,import.meta.url);
 const digest=createHash('sha256').update(await readFile(path)).digest('hex');
 if(record.host!==extra.host||record.file!==extra.file||record.sha256!==digest||digest!==extra.sha256)throw Error('Candidate archive changed after verification.');
 await copyFile(path,new URL(extra.file,destination));sums+=digest+'  '+extra.file+'\n';
}
for(const old of release.previousCandidateArtifacts??[]){
 const path=new URL('../artifacts/'+old.host+'-release/'+old.file,import.meta.url);
 if(createHash('sha256').update(await readFile(path)).digest('hex')!==old.sha256)throw Error('Previously published candidate changed.');
 await copyFile(path,new URL(old.file,destination));sums+=old.sha256+'  '+old.file+'\n';
}
await writeFile(new URL('SHA256SUMS.txt',destination),sums);
console.log('Approved beta and labeled candidate downloads/checksums prepared.');
