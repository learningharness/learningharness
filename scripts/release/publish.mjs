import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {releaseManifest} from './manifest.mjs';
const repository='learningharness/learningharness';
export async function publishRelease({directory,gh}){
 const manifest=JSON.parse(await readFile(join(directory,'install.json'),'utf8')),commit=manifest.source.commit,version=manifest.artifacts[0].version,tag='v'+version;
 const artifacts=manifest.artifacts.map(a=>({host:a.host,file:a.packageRoot+'.zip',sha256:a.sha256}));
 if(JSON.stringify(manifest)!==JSON.stringify(releaseManifest({version,commit,artifacts})))throw Error('Release manifest is invalid');
 for(const artifact of artifacts){
  const digest=createHash('sha256').update(await readFile(join(directory,artifact.file))).digest('hex');
  if(digest!==artifact.sha256)throw Error('Release archive checksum mismatch');
 }
 const requireCurrentMain=()=>{if(gh(['api',`repos/${repository}/branches/main`,'--jq','.commit.sha']).trim()!==commit)throw Error('A newer main commit exists; refusing to move latest backward');};
 requireCurrentMain();
 let release;
 try{release=JSON.parse(gh(['api',`repos/${repository}/releases/tags/${tag}`]));}
 catch(error){if(!String(error.stderr).includes('HTTP 404'))throw error;}
 if(release&&release.target_commitish!==commit)throw Error('Release tag belongs to different source');
 if(!release){
  gh(['release','create',tag,'--repo',repository,'--draft','--target',commit,'--title',`LearningHarness ${version}`,'--notes-file',join(directory,'RELEASE_NOTES.md')]);
  release=JSON.parse(gh(['api',`repos/${repository}/releases/tags/${tag}`]));
 }
 const files=[...artifacts.map(a=>a.file),'install.json','install.md','SHA256SUMS.txt'];
 const temporary=await mkdtemp(join(tmpdir(),'lh-release-verify-'));
 try{
  for(const name of files){
   if(release.assets.some(a=>a.name===name)){
    gh(['release','download',tag,'--repo',repository,'--pattern',name,'--dir',temporary]);
    if(!(await readFile(join(temporary,name))).equals(await readFile(join(directory,name))))throw Error('Published asset differs; use a new version: '+name);
   }else{
    if(!release.draft)throw Error('Published release is incomplete; refusing to modify it');
    gh(['release','upload',tag,join(directory,name),'--repo',repository]);
   }
  }
  requireCurrentMain();
  gh(['release','edit',tag,'--repo',repository,'--draft=false','--latest']);
  return `https://github.com/${repository}/releases/tag/${tag}`;
 }finally{await rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const gh=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 console.log('Published '+await publishRelease({directory:resolve('artifacts/main-release/publish'),gh}));
}
