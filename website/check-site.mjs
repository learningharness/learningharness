import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {parse} from 'parse5';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./hosting-dist/',import.meta.url));
async function files(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())result.push(...await files(path));else result.push(path);}return result;}
const all=await files(root),pages=all.filter(p=>p.endsWith('.html')),documents=new Map();
function nodes(node){return [node,...(node.childNodes??[]).flatMap(nodes)];}
for(const path of pages){const text=await readFile(path,'utf8');const tree=nodes(parse(text));documents.set(path,tree);if(/github\.com\/(?!dontdumb(?:\/|"|$))[^/"\s]+\/dontdumb/i.test(text))throw Error('Non-organization project link: '+path);if(tree.filter(n=>n.tagName==='h1').length!==1)throw Error('Expected one page heading: '+path);}
let checked=0;
for(const [path,tree] of documents){for(const node of tree){for(const attr of node.attrs??[]){if(!['href','src'].includes(attr.name)||/^(https?:|mailto:|data:)/.test(attr.value))continue;const url=new URL(attr.value,'https://local/'+relative(root,path));let target=resolve(root,'.'+decodeURIComponent(url.pathname));try{if((await stat(target)).isDirectory())target=resolve(target,'index.html');await stat(target);}catch{throw Error(`Missing link ${attr.value} in ${relative(root,path)}`);}if(url.hash){const id=decodeURIComponent(url.hash.slice(1));const dest=documents.get(target);if(dest&&!dest.some(n=>(n.attrs??[]).some(a=>a.name==='id'&&a.value===id)))throw Error('Missing anchor '+attr.value);}checked++;}}}
const release=JSON.parse(await readFile(new URL('./release-readiness.json',import.meta.url),'utf8'));
if(!release.approved&&all.some(p=>p.includes('/downloads/')))throw Error('Unreleased binaries present');
console.log(`Validated ${pages.length} pages and ${checked} local links/assets. Product download gate preserved.`);

const manifest=JSON.parse(await readFile(resolve(root,'install.json'),'utf8'));
if(manifest.schemaVersion!==1||manifest.status!==(release.approved?'available':'unreleased'))throw Error('Installation status disagrees with release gate');
if(!release.approved&&manifest.artifacts.length)throw Error('Unreleased installer advertised to agents');
await stat(resolve(root,'install.md'));
console.log('Agent install guide and release manifest verified.');

if(release.approved){
 if(manifest.artifacts.length!==2||manifest.artifacts.map(a=>a.host).join(',')!=='codex,claude')throw Error('Expected Codex beta and Claude candidate');
 const candidate=manifest.artifacts.find(a=>a.host==='claude');if(candidate.channel!=='release-candidate'||candidate.nativeAcceptance!=='pending')throw Error('Claude candidate acceptance disclosure missing');
 for(const artifact of manifest.artifacts){
  const path=resolve(root,'.'+artifact.url);await stat(path);
  if(!artifact.url.startsWith('/downloads/')||!/^([a-f0-9]{64})$/.test(artifact.sha256))throw Error('Invalid public installer record');
 }
}
