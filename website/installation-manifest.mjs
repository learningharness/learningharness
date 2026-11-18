import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {releaseCatalog} from './release-catalog.mjs';
export async function installationManifest({approved,directory,release}){
 const manifest={schemaVersion:1,channel:'public-beta',status:approved?'available':'unreleased',instructions:'/install.md',platform:'darwin',nodeMinimum:'22.19.0',artifacts:[]};
 if(!approved)return manifest;
 const packages=releaseCatalog(release??JSON.parse(await readFile(new URL('./release-readiness.json',import.meta.url),'utf8')));
 const sums=await readFile(new URL('downloads/SHA256SUMS.txt',directory),'utf8');
 for(const pkg of packages){
  const filename=pkg.packageRoot+'.zip',sha256=createHash('sha256').update(await readFile(new URL('downloads/'+filename,directory))).digest('hex');
  if(!sums.split('\n').some(line=>line===sha256+'  '+filename))throw new Error('Installer checksum mismatch: '+filename);
  manifest.artifacts.push({...pkg,url:'/downloads/'+filename,sha256});
 }
 return manifest;
}
