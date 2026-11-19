import {build as bundle} from 'esbuild';
import {build as uiBuild} from 'vite';
import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeDistributionNotices} from '../distribution-notices.mjs';
const version=process.env.LH_CANDIDATE_VERSION??'1.0.0-beta.63',root=resolve(process.env.LH_CLAUDE_PACKAGE_DIR??'artifacts/claude-native-candidate');
if(!/^1\.0\.0-beta\.\d+$/.test(version))throw Error('Invalid candidate version');
await mkdir(root,{recursive:true});await mkdir(join(root,'hooks'),{recursive:true});await mkdir(join(root,'.claude-plugin'),{recursive:true});
const uiDir=join(root,'ui-build');
await uiBuild({configFile:'scripts/desktop-runtime/vite.config.mjs',build:{outDir:uiDir},plugins:[{name:'claude-web-frame',enforce:'pre',async load(id){
 if(!id.endsWith('/scripts/desktop-runtime/web/entry.tsx'))return;
 const code=await readFile(id,'utf8');
 if(!code.includes("render(()=><Root/>,document.getElementById('root')!);"))throw Error('Shared UI entry changed; review Claude wrapper');
 return "import {ClaudeLauncher} from '../../claude-release/Launcher';\n"+code.replace('function App(){','function LearnApp(){').replace('function Root(){',"function App(){return document.documentElement.dataset.invitation==='true'?<LearnApp/>:<ClaudeLauncher><LearnApp/></ClaudeLauncher>;}\nfunction Root(){");
}}]});
let html=await readFile(join(uiDir,'index.html'),'utf8');
for(const file of await readdir(join(uiDir,'assets'))){const text=await readFile(join(uiDir,'assets',file),'utf8');if(file.endsWith('.js'))html=html.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,()=>'<script type="module">'+text.replace(/<\/script/gi,'<\\/script')+'</script>');if(file.endsWith('.css'))html=html.replace(/<link rel="stylesheet"[^>]*>/,()=>'<style>'+text+'</style>');}
html=html.replace('<html','<html data-learning-host="claude"');if(/(?:src|href)="\/assets\//.test(html))throw Error('Unbundled candidate view');await writeFile(join(root,'view.html'),html);
const canonicalPath=resolve('scripts/codex-release/server.mjs');
const canonical=(await readFile(canonicalPath,'utf8')).split('// A live MCP connection')[0]
 .replace("const uri='ui://learning-harness/v19/learn',settingsUri='ui://learning-harness/v19/settings';","const uri='ui://learning-harness/claude/v1/learn',settingsUri='ui://learning-harness/claude/v1/settings';")
 .replace(/version:'1\.0\.0-beta\.\d+'/,`version:'${version}'`)
 .replaceAll('exact Codex chat','exact Claude Code chat').replaceAll('Codex has not supplied','Claude has not supplied')
 .replace("p.uri===invitationUri?' data-invitation=\"true\" data-inline-invitation':''","p.uri===invitationUri?' data-invitation=\"true\" data-inline-invitation':' data-claude-launcher=\"true\"'")
 .replace("{_meta:{'openai/ui':{preferredDisplayMode:'inline',availableDisplayModes:['inline','fullscreen']},'openai/widgetMinFrameHeight':0,'openai/widgetHeightHint':40,'openai/widgetShowCodexWidgetInline':true,'openai/widgetHideAttribution':true,'openai/widgetHideActions':true}}","{_meta:{ui:{prefersBorder:false}}}");
if(canonical.includes('openai/'))throw Error('Claude candidate must not copy OpenAI presentation metadata');
const alias={name:'claude-host-boundary',setup(build){
 build.onResolve({filter:/canonical-server\.mjs$/},()=>({path:'canonical-server.mjs',namespace:'claude-canonical'}));
 build.onLoad({filter:/.*/,namespace:'claude-canonical'},()=>({contents:canonical,resolveDir:resolve('scripts/codex-release'),loader:'js'}));
 build.onResolve({filter:/\/(host-adapter|chain)\.mjs$|^\.\/(host-adapter|chain)\.mjs$/},args=>{
  if(args.path.endsWith('host-adapter.mjs'))return {path:resolve('scripts/claude-release/host-adapter.mjs')};
  if(args.path.endsWith('chain.mjs'))return {path:resolve('scripts/claude-release/chain.mjs')};
 });
}};
for(const [name,source] of [['server','scripts/claude-release/server.mjs'],['runtime-service','scripts/desktop-runtime/runtime-service.mjs'],['hook','scripts/claude-release/hook.mjs'],['entry-status','scripts/claude-release/entry-status.mjs']])await bundle({entryPoints:[source],outfile:join(root,name+'.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',plugins:[alias],define:{'process.env.LEARNING_HARNESS_HOST':'"claude"'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
await bundle({entryPoints:['scripts/claude-release/entry-register.mjs'],outfile:join(root,'register.mjs'),bundle:true,platform:'node',format:'esm',target:'node22'});
await writeFile(join(root,'.claude-plugin/plugin.json'),JSON.stringify({name:'learningharness',displayName:'LearningHarness',version,author:{name:'LearningHarness'},homepage:'https://learningharness.dev',repository:'https://github.com/learningharness/learningharness',icon:'./assets/icon.png',description:'Learn beside Claude Code. Requires the local Claude Code CLI signed in with an active Claude subscription; Desktop sign-in alone may not cover it. Uses normal Claude login, no password or token collection.'},null,2));
await writeFile(join(root,'.claude-plugin/marketplace.json'),JSON.stringify({name:'learningharness-claude-candidate',description:'LearningHarness native Claude Code candidate. Requires normal Claude Code CLI subscription sign-in.',owner:{name:'LearningHarness'},plugins:[{name:'learningharness',source:'./',description:'A tutor beside Claude Code. Requires normal Claude Code CLI subscription sign-in.'}]},null,2));
const command='node "${CLAUDE_PLUGIN_ROOT}/hook.mjs"';
await writeFile(join(root,'hooks/hooks.json'),JSON.stringify({modules:['../register.mjs'],hooks:Object.fromEntries(['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','Stop'].map(event=>[event,[{hooks:[{type:'command',command,timeout:2}]}]]))},null,2));
await mkdir(join(root,'commands'),{recursive:true});await cp('scripts/claude-release/commands/learn.md',join(root,'commands/learn.md'));
await cp('scripts/claude-release/README.md',join(root,'START_HERE.md'));
await cp('scripts/claude-release/README.md',join(root,'README.md'));
await mkdir(join(root,'assets'),{recursive:true});await cp('scripts/claude-release/assets/icon.png',join(root,'assets/icon.png'));
await writeDistributionNotices(root);
// Preserve the project license alongside separate third-party notices.
await cp('LICENSE',join(root,'LICENSE'));
await bundle({entryPoints:['scripts/claude-release/install.mjs'],outfile:join(root,'install.mjs'),bundle:true,platform:'node',format:'esm',target:'node22'});
await writeFile(join(root,'candidate.json'),JSON.stringify({version,publicRelease:false,baseline:`Current shared Codex/Claude UI/runtime (${version} feature baseline)`,adapterRevision:5,acceptance:'pending native hook binding and journey'},null,2));
console.log(root);
