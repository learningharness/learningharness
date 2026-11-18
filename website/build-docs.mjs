import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
const root=new URL('./dist/docs/',import.meta.url);
const diagram=await readFile(new URL('./fragments/harness-diagram.html',import.meta.url),'utf8');
import {customerPages} from './doc-pages.mjs';
const pages=customerPages(diagram);
await rm(root,{recursive:true,force:true});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
for(let i=0;i<pages.length;i++){
 let [slug,label,title,body]=pages[i];
 const dir=new URL(slug?slug+'/':'',root);await mkdir(dir,{recursive:true});
 const nav=pages.map(([path,name])=>`<a href="/docs/${path?path+'/':''}"${path===slug?' aria-current="page"':''}>${name}</a>`).join('');
 const previous=i?`<a href="/docs/${pages[i-1][0]?pages[i-1][0]+'/':''}">← ${pages[i-1][1]}</a>`:'<a href="/">← Product</a>';
 const next=i<pages.length-1?`<a href="/docs/${pages[i+1][0]}/">${pages[i+1][1]} →</a>`:'';
 await writeFile(new URL('index.html',dir),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(label)} — LearningHarness Docs</title><meta name="description" content="${escape(title)}"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/assets/style.css?v=20261107-architecture"></head><body><a class="skip-docs" href="#content">Skip to content</a><div class="wrap"><header><a class="brand" href="/"><img src="/assets/mark.svg" width="28" height="28" alt=""><span class="wordmark">LearningHarness</span></a><nav aria-label="Main"><a href="/">Product</a><a href="https://github.com/learningharness/learningharness/issues">Help ↗</a></nav></header><main class="docs"><aside aria-label="Documentation navigation"><span class="eyebrow">DOCUMENTATION</span>${nav}</aside><article id="content"><div class="docs-crumb">DOCS / ${label.toUpperCase()}</div><h1>${title}</h1>${body}<nav class="docs-pagination" aria-label="Documentation pages">${previous}${next}</nav></article></main><footer><a href="/">LearningHarness</a><a href="/docs/privacy/">Privacy & data</a></footer></div></body></html>`);
}
await writeFile(new URL('./dist/install.md',import.meta.url),await readFile(new URL('./install-guide.md',import.meta.url),'utf8'));
console.log('Generated '+pages.length+' documentation pages.');

await writeFile(new URL('./dist/claude-test-plan.md',import.meta.url),await readFile(new URL('./claude-test-plan.md',import.meta.url),'utf8'));
