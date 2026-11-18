import {releaseCatalog,renderReleaseLinks} from './release-catalog.mjs';
import {withholdDownloads} from './withhold-downloads.mjs';
import {installationManifest} from './installation-manifest.mjs';
import {cp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('./',import.meta.url),source=new URL('dist/',root),target=new URL('hosting-dist/',root);
const release=JSON.parse(await readFile(new URL('release-readiness.json',root),'utf8'));
if(release.approved===true)execFileSync(process.execPath,[new URL('check-release.mjs',root).pathname],{stdio:'inherit'});
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
// Publish current pages and their explicit assets only. Old screenshots and
// historical demonstrations stay in the private checkout.
const publicAssets=new Set(['og-learningharness-v2.svg','og-learningharness-v2.png','og-learningharness-v1.png','product-experience.mp4','product-experience-poster.jpg','landing.css','landing.mjs','retry-model.mjs','stellar-duet.mjs','thesis.css','thesis.mjs','thesis-claude-history.jpg','thesis-claude-source.jpg','thesis-codex-practice.jpg','thesis-memory.png','claude-slash-command.png','claude-inline-expand.png','claude-learning-panel.png','claude-launcher-default-off.png','codex-new-tab.png','codex-more-tools.png','codex-learning-panel.png','mark.svg','favicon.svg','style.css']);
await cp(source,target,{recursive:true,filter:path=>{
 const parts=path.split('/');
 if(parts.includes('downloads'))return release.approved===true;
 const assets=parts.lastIndexOf('assets');
 return assets<0||assets===parts.length-1||publicAssets.has(parts.at(-1));
}});
async function htmlFiles(directory,prefix=''){
 const files=[];
 for(const item of await readdir(directory,{withFileTypes:true})){
  const path=prefix+item.name;
  if(item.isDirectory())files.push(...await htmlFiles(new URL(item.name+'/',directory),path+'/'));
  else if(item.name.endsWith('.html'))files.push(path);
 }
 return files;
}
if(release.approved!==true){
 for(const file of await htmlFiles(target)){
  const path=new URL(file,target);let html=withholdDownloads(await readFile(path,'utf8'));
  if(file==='index.html'){
   html=withholdDownloads(html);
   html=html.replace('Free public beta. Uses your existing model allowance.','Installers are currently unavailable. Check the installation guide for release status.');
   html=html.replace('<a class="button" href="downloads/dontdumb-first-run-trial.zip" download>Download macOS trial ↓</a>','<span class="button" aria-disabled="true">Desktop release coming soon</span>');
   html=html.replace('Download the local beta <span>↓</span>','Explore the learning harness <span>↓</span>');
   html=html.replace(/href="downloads\/dontdumb-(codex|claude|opencode)-[^"]+\.zip" download/g,(_,host)=>`href="docs/${host==='claude'?'claude-code':host}/"`);
   html=html.replace('// free local beta','// desktop release coming soon').replace('Try it on real work. Tell us what helped, what interrupted, and what never showed up.','A learning harness for developers who want to keep their skills sharp. Desktop installers will be available here when the release is ready.');
   html=html.replace('Unsigned local installers · Node 22+ · no Terminal setup<br>Includes setup guides and a repeatable test task.','Planned for macOS · Node 22+ · existing AI connection');
   html=html.replace('macOS installer ↓','Desktop setup guide ↗').replace('Local Code installer ↓','Local Code setup guide ↗').replace('Desktop 2.2.5 installer ↓','Desktop 2.2.5 setup guide ↗');
  }else{
   html=html.replace(/<p><a href="\.\.\/downloads\/dontdumb-first-run-trial.zip" download>[\s\S]*?<\/p>/,'<p>Desktop installers will be available when the release is ready. The setup guides below describe the intended installation flow; downloads are not yet public.</p>');
  }
  if(/href="[^\"]*downloads\//.test(html))throw new Error('Unreleased download link remains');
  await writeFile(path,html);
 }
}
if(release.approved===true){const catalog=releaseCatalog(release);for(const file of await htmlFiles(target)){const path=new URL(file,target);await writeFile(path,renderReleaseLinks(await readFile(path,'utf8'),catalog));}}
console.log(release.approved===true?'Website and approved product downloads prepared.':'Website prepared; unreleased product downloads excluded.');

await writeFile(new URL('install.json',target),JSON.stringify(await installationManifest({approved:release.approved===true,directory:target}),null,2)+'\n');

// Website acquisition telemetry is separate from local learner telemetry.
const analyticsConfig=JSON.parse(await readFile(new URL('web-analytics-config.json',root),'utf8'));
await cp(new URL('web-analytics.mjs',root),new URL('assets/web-analytics.mjs',target));
await writeFile(new URL('assets/web-analytics-init.mjs',target),`import {startAnalytics} from './web-analytics.mjs';startAnalytics(${JSON.stringify(analyticsConfig)});`);
for(const file of await htmlFiles(target)){
 const path=new URL(file,target);let html=withholdDownloads(await readFile(path,'utf8'));
 html=html.replace('</body>','<script type="module" src="/assets/web-analytics-init.mjs"></script></body>');
 if(file==='docs/privacy/index.html')html=html.replace('</article>','<h2>Website analytics</h2><p>Anonymous PostHog events count page views, download-link clicks, installation-guide clicks and copy-prompt clicks. We send only a bounded page path, campaign category, referrer category and platform. No cookies, browser storage, session replay, fingerprinting, names, code or learning responses are collected by this instrumentation. Each page load gets a fresh random identifier. Do Not Track and Global Privacy Control disable it. A click is not proof of a completed download or installation.</p></article>');
 await writeFile(path,html);
}
