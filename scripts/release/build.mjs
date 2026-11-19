import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {releaseManifest} from './manifest.mjs';
const version=process.env.LH_CANDIDATE_VERSION,commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
// Validate before building or writing any output.
releaseManifest({version,commit,artifacts:['codex','claude'].map(host=>({host,file:`learning-harness-${host}-${version}.zip`,sha256:'0'.repeat(64)}))});
const root=resolve('artifacts/main-release'),codex=join(root,'build/codex'),claude=join(root,'build/claude'),output=join(root,'publish');
await mkdir(output,{recursive:true});
const analytics=JSON.parse(await readFile('scripts/distribution/analytics-config.json','utf8'));
const env={...process.env,LH_CANDIDATE_VERSION:version,LH_CANDIDATE_OUTPUT:codex,LH_CLAUDE_PACKAGE_DIR:claude,LEARNING_HARNESS_POSTHOG_TOKEN:analytics.token,LEARNING_HARNESS_POSTHOG_HOST:analytics.host};
for(const script of ['scripts/package-native-codex.mjs','scripts/claude-release/package.mjs'])execFileSync(process.execPath,[script],{env,stdio:'inherit'});
const artifacts=[];
for(const host of ['codex','claude']){
 const name=`learning-harness-${host}-${version}`,directory=host==='codex'?join(codex,name):claude;
 const plugin=JSON.parse(await readFile(join(directory,host==='codex'?'plugin/.codex-plugin/plugin.json':'.claude-plugin/plugin.json'),'utf8'));
 if(plugin.version!==version)throw Error('Packaged plugin version differs');
 await writeFile(join(directory,'SOURCE.json'),JSON.stringify({repository:'https://github.com/learningharness/learningharness',commit,version},null,2)+'\n');
 const file=name+'.zip';execFileSync('python3',['scripts/release/archive.py',directory,join(output,file),name],{stdio:'inherit'});
 artifacts.push({host,file,sha256:createHash('sha256').update(await readFile(join(output,file))).digest('hex')});
}
await writeFile(join(output,'install.json'),JSON.stringify(releaseManifest({version,commit,artifacts}),null,2)+'\n');
await cp('install.md',join(output,'install.md'));
await writeFile(join(output,'SHA256SUMS.txt'),artifacts.map(a=>`${a.sha256}  ${a.file}\n`).join(''));
await writeFile(join(output,'RELEASE_NOTES.md'),`# LearningHarness ${version}\n\nAutomatic early-access build from [${commit}](https://github.com/learningharness/learningharness/commit/${commit}). Linux and Mac source checks passed before publication.\n\nCodex is early access. Claude is experimental. Native acceptance remains pending. This release does not establish learning outcomes. Existing evidence limits: [Status](https://github.com/learningharness/learningharness/blob/${commit}/docs/STATUS.md).\n\nInstall or check for updates: [installation guide](https://github.com/learningharness/learningharness/releases/latest/download/install.md). Existing installations require an explicit update and full host restart; publishing does not modify them.\n`);
console.log(`Prepared ${version} from ${commit}: ${output}`);
