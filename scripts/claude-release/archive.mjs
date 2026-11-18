// Stage a self-contained candidate. Never edits or publishes website downloads.
import {mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=resolve(process.env.LH_CLAUDE_PACKAGE_DIR??'artifacts/claude-native-candidate');
const candidate=JSON.parse(await readFile(join(source,'candidate.json'),'utf8'));
const name='learning-harness-claude-'+candidate.version,parent=resolve('artifacts/claude-release'),root=join(parent,name);
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
for(const file of ['server.mjs','runtime-service.mjs','hook.mjs','view.html','install.mjs','README.md','START_HERE.md','LICENSE','BETA_NOTICE.md','THIRD_PARTY_NOTICES.txt','candidate.json','.claude-plugin/plugin.json','hooks/hooks.json','commands/learn.md','register.mjs','entry-status.mjs','assets/icon.png']){await mkdir(dirname(join(root,file)),{recursive:true});await cp(join(source,file),join(root,file));}
await writeFile(join(root,'.claude-plugin/marketplace.json'),JSON.stringify({name:'learningharness-claude-candidate',description:'LearningHarness native Claude Code candidate. Requires normal Claude Code CLI subscription sign-in.',owner:{name:'LearningHarness'},plugins:[{name:'learningharness',source:'./',description:'A tutor beside Claude Code. Requires normal Claude Code CLI subscription sign-in.'}]},null,2));
const filename=name+'.zip',archive=join(parent,filename);await rm(archive,{force:true});execFileSync('/usr/bin/zip',['-qr',filename,name],{cwd:parent});
const sha256=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(join(parent,'SHA256SUMS.txt'),sha256+'  '+filename+'\n');
await writeFile(join(parent,'candidate.json'),JSON.stringify({host:'claude',version:candidate.version,file:filename,packageRoot:name,sha256,status:'candidate',published:false,acceptance:{nativeAutomaticBinding:false,nativeJourney:false,directoryReview:false}},null,2));
console.log(JSON.stringify({archive,sha256,published:false}));
