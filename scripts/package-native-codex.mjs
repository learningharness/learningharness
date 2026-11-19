import {build as bundle} from 'esbuild';
import {build as buildUI} from 'vite';
import {mkdir,readFile,writeFile,readdir,rm,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {homedir} from 'node:os';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {writeDistributionNotices} from './distribution-notices.mjs';
const version=process.env.LH_CANDIDATE_VERSION??'1.0.0-beta.63',name='learning-harness-codex-'+version;
if(!/^1\.0\.0-beta\.\d+$/.test(version))throw Error('Invalid candidate version');
if(process.env.LH_DESKTOP_CANDIDATE==='1'&&!process.env.LH_CANDIDATE_OUTPUT)throw Error('Desktop candidates require an isolated output directory');
const output=resolve(process.env.LH_CANDIDATE_OUTPUT??'artifacts/codex-release'),root=join(output,name),plugin=join(root,'plugin');
let config={};try{config=JSON.parse(await readFile(join(homedir(),'.local/share/learning-harness/analytics.json'),'utf8'));}catch{}
const token=process.env.LEARNING_HARNESS_POSTHOG_TOKEN??config.token,host=process.env.LEARNING_HARNESS_POSTHOG_HOST??config.host??'https://us.i.posthog.com';
if(!/^phc_[a-zA-Z0-9_-]+$/.test(token??'')||!['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(host))throw Error('Configure a public PostHog capture token and allowed ingestion host before packaging. Never use a management key.');
await buildUI({configFile:'scripts/desktop-runtime/vite.config.mjs'});
await rm(root,{recursive:true,force:true});await mkdir(join(plugin,'.codex-plugin'),{recursive:true});await mkdir(join(plugin,'hooks'),{recursive:true});await mkdir(join(root,'.agents/plugins'),{recursive:true});
const json=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const bundled=await bundle({entryPoints:{...(process.env.LH_DESKTOP_CANDIDATE==='1'?{'desktop-controls':'scripts/desktop-controls/entry.mjs'}:{}),server:'scripts/codex-release/server.mjs','runtime-service':'scripts/desktop-runtime/runtime-service.mjs','chain-hook':'scripts/desktop-runtime/chain-hook.mjs'},outdir:plugin,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:false,metafile:true,legalComments:'none',plugins:[{name:'codex-only-release',setup(b){
 b.onResolve({filter:/(?:^|\/)host-adapter\.mjs$/},()=>({path:resolve('scripts/codex-release/host-adapter.mjs')}));
 b.onResolve({filter:/(?:^|\/)chain\.mjs$/},()=>({path:resolve('scripts/codex-release/chain.mjs')}));
}}]});
let html=await readFile('scripts/desktop-runtime/dist/index.html','utf8');
for(const file of await readdir('scripts/desktop-runtime/dist/assets')){const text=await readFile(join('scripts/desktop-runtime/dist/assets',file),'utf8');if(file.endsWith('.js'))html=html.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,()=>'<script type="module">'+text.replace(/<\/script/gi,'<\\/script')+'</script>');if(file.endsWith('.css'))html=html.replace(/<link rel="stylesheet"[^>]*>/,()=>'<style>'+text+'</style>');}
if(/(?:src|href)="\/assets\//.test(html))throw Error('Unbundled UI asset');await writeFile(join(plugin,'view.html'),html);
await mkdir(join(plugin,'assets'),{recursive:true});
const logo=await readFile('scripts/distribution/assets/mark.svg','utf8');
await writeFile(join(plugin,'assets/logo-dark.svg'),logo);
await writeFile(join(plugin,'assets/logo.svg'),logo.replace('#f2f1ee','#17181c'));
await json(join(plugin,'.codex-plugin/plugin.json'),{name:'learning-harness',version,description:'Learn from your work alongside Codex, using your existing Codex connection.',mcpServers:'./.mcp.json',interface:{displayName:'LearningHarness',shortDescription:'A tutor beside your Codex work',developerName:'LearningHarness',category:'Productivity',logo:'./assets/logo.svg',logoDark:'./assets/logo-dark.svg',composerIcon:'./assets/logo.svg',composerIconDark:'./assets/logo-dark.svg'}});
// install.mjs resolves these portable placeholders to the persistent installed copy.
await json(join(plugin,'.mcp.json'),{mcpServers:{learn:{command:'node',args:['server.mjs'],env:{LEARNING_HARNESS_HOST:'codex',LEARNING_HARNESS_POSTHOG_TOKEN:token,LEARNING_HARNESS_POSTHOG_HOST:host,LEARNING_HARNESS_ANALYTICS_ENVIRONMENT:'production'}}}});
await json(join(plugin,'hooks/hooks.json'),{description:'LearningHarness notices active chat work and signals when learning is ready. Review these local hooks before use; they do not generate lessons or change project files.',hooks:Object.fromEntries(['SessionStart','UserPromptSubmit','PostToolUse'].map(event=>[event,[{hooks:[{type:'command',command:'node "${PLUGIN_ROOT}/chain-hook.mjs"',timeout:2}]}]]))});
await json(join(root,'.agents/plugins/marketplace.json'),{name:'learning-harness-desktop',interface:{displayName:'LearningHarness Desktop'},plugins:[{name:'learning-harness',source:{source:'local',path:'./plugin'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]});
await copyFile('scripts/codex-release/install.mjs',join(root,'install.mjs'));
await writeDistributionNotices(root);await copyFile('LICENSE',join(root,'LICENSE'));
await writeFile(join(root,'BETA_NOTICE.md'),'# LearningHarness for Codex desktop — beta\n\nFor local installation on macOS with Node.js 22.19 or later and an existing Codex ChatGPT sign-in. This is a manual desktop plugin, not a public-directory listing. Review its hooks yourself.\n\nLearning uses additional Codex allowance; no extra model API key or LearningHarness inference backend is involved. Selected work and learner context reach Codex. Learner memory stays local. PostHog usage metadata is on by default; turn off Share anonymous usage in Learn to opt out. The local plugin runs under your user account; the entire plugin is not an OS sandbox.\n\nThird-party licenses are in THIRD_PARTY_NOTICES.txt. LearningHarness-owned code is MIT licensed; see LICENSE. Third-party components retain their own licenses.\n');
await copyFile('scripts/codex-release/START_HERE.md',join(root,'START_HERE.md'));
await writeFile(join(output,'RELEASE_NOTES.md'),'# LearningHarness for Codex desktop\n\nA local learning view alongside your Codex work, using your existing Codex model connection. Includes learning interests, questions, explanations, interactive learning, local practice memory and usage controls. Additional Codex allowance is consumed. PostHog usage metadata is on by default, with an opt-out in Learn. Manual desktop installation and hook review are required.\n');
execFileSync('python3',['-c',`from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(${JSON.stringify(root)})
with ZipFile(${JSON.stringify(join(output,name+'.zip'))},'w',ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,str(Path(root.name)/p.relative_to(root)))
`]);
const bytes=await readFile(join(output,name+'.zip')),sha256=createHash('sha256').update(bytes).digest('hex');
await writeFile(join(output,'SHA256SUMS.txt'),sha256+'  '+name+'.zip\n');
const inputs={};for(const path of Object.keys(bundled.metafile.inputs))inputs[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await json(join(output,'build-evidence.json'),{runtimeInputs:inputs,uiBundleSHA256:createHash('sha256').update(html).digest('hex'),archiveSHA256:sha256,notes:'Private build record; not release approval or a reproducibility claim. Includes current shared-workspace inputs.'});
await json(join(output,'candidate.json'),{schemaVersion:1,status:'unaccepted',host:'codex',version,file:name+'.zip',sha256,checks:{relocation:'pending',fresh_install:'pending',native_ui:'pending',session_binding:'pending',host_model:'pending',live_eval:'see private evidence; not package acceptance'}});
console.log('Prepared unaccepted Codex candidate: '+join(output,name+'.zip'));
