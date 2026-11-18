import {assertPublicationReady} from './release-policy.mjs';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const gate=JSON.parse(await readFile(new URL('./release-readiness.json',import.meta.url),'utf8'));
assertPublicationReady(gate);
for(const name of [gate.artifact.file,'SHA256SUMS.txt'])await access(new URL('./dist/downloads/'+name,import.meta.url));
console.log('Recorded release gates and downloads are ready.');

const bytes=await readFile(new URL('./dist/downloads/'+gate.artifact.file,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==gate.artifact.sha256)throw Error('Published package differs from the owner-approved beta artifact.');

for(const candidate of gate.candidateArtifacts??[]){const bytes=await readFile(new URL('./dist/downloads/'+candidate.file,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==candidate.sha256)throw Error('Candidate bytes differ from approved checksum.');}
