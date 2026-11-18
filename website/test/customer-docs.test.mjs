import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const docs=new URL('../dist/docs/',import.meta.url);
async function pages(root){const found=[];for(const f of await readdir(root,{withFileTypes:true})){const p=new URL(f.name+(f.isDirectory()?'/':''),root);if(f.isDirectory())found.push(...await pages(p));else if(f.name.endsWith('.html'))found.push(await readFile(p,'utf8'));}return found;}
test('customer docs exclude private engineering instructions and source maps',async()=>{
 const all=await pages(docs);assert.ok(all.length>=10);
 for(const html of all){
  assert.doesNotMatch(html,/packages\/runtime\/|learning-engine\.js|COORDINATOR\.md|eval:dontdumb|Implementation map|No public npm|is not proof|do not claim|what success means|actual host path/i);
  assert.match(html,/<h1>/);
 }
});
test('privacy, consumption and support remain actionable after editorial cleanup',async()=>{
 const privacy=await readFile(new URL('privacy/index.html',docs),'utf8');
 assert.match(privacy,/existing.*model connection/);assert.match(privacy,/PostHog/);assert.match(privacy,/on by default/);assert.match(privacy,/Share anonymous usage/);
 const usage=await readFile(new URL('token-usage/index.html',docs),'utf8');assert.match(usage,/additional tokens/);assert.match(usage,/turn learning off/);
 const help=await readFile(new URL('troubleshooting/index.html',docs),'utf8');assert.match(help,/learningharness\/issues/);
});
test('public pages distinguish Codex beta and Claude candidate and omit private engineering',async()=>{
 const all=[...await pages(docs),await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),await readFile(new URL('../dist/install.md',import.meta.url),'utf8')];
 for(const text of all){
  assert.doesNotMatch(text,/OpenCode|Pi agent|custom executor|native executor|COORDINATOR|artifacts\/evals|packages\/runtime|github\.com\/dontdumb\/dontdumb(?:[\/"\s]|$)|\/Users\//i);
 }
 const codex=await readFile(new URL('codex/index.html',docs),'utf8');
 assert.doesNotMatch(codex,/Watch this chat|browser panel|companion|upcoming integration/i);
 assert.match(codex,/release status/i);
});
test('unapproved source checkout prepares documentation without claiming a binary release',async()=>{
 const root=new URL('../hosting-dist/',import.meta.url);
 const assets=await readdir(new URL('assets/',root));
 assert.ok(assets.includes('mark.svg'));
 const manifest=JSON.parse(await readFile(new URL('install.json',root),'utf8'));
 assert.equal(manifest.status,'unreleased');
 assert.deepEqual(manifest.artifacts,[]);
 const landing=await readFile(new URL('index.html',root),'utf8');
 assert.doesNotMatch(landing,/href="downloads\/learning-harness-[^"]+" download/);
});

test('manual install explicitly requires a full app restart before verification',async()=>{
 const guide=await readFile(new URL('../dist/install.md',import.meta.url),'utf8');
 assert.match(guide,/restart is required/i);assert.match(guide,/registration is not completion/i);assert.match(guide,/Do not report.*ready to use/);assert.match(guide,/Quit ChatGPT/);
 for(const path of ['codex/index.html','troubleshooting/index.html']){
  const html=await readFile(new URL(path,docs),'utf8');assert.match(html,/Quit ChatGPT/);assert.match(html,/LearningHarness Desktop/);assert.match(html,/New tab/);assert.match(html,/More tools/);assert.match(html,/Open LearningHarness/);
 }
});

test('public product branding is LearningHarness throughout visible copy',async()=>{
 const all=[...await pages(docs),await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),await readFile(new URL('../dist/install.md',import.meta.url),'utf8')];
 for(const text of all){
  // Existing GitHub ownership URLs stay valid until the account migration is verified.
  const visible=text.replace(/https?:[^\s<"')]+/g,'');
  assert.doesNotMatch(visible,/DontDumb|Learning Harness/);
 }
});

test('Claude candidate guide discloses CLI sign-in, native uncertainty and connector setup',async()=>{
 const page=await readFile(new URL('claude-code/index.html',docs),'utf8');assert.match(page,/release candidate/i);assert.match(page,/CLI.*active Claude subscription/);assert.match(page,/Desktop sign-in alone/);assert.match(page,/marketplace alone/);assert.match(page,/acceptance testing/);assert.match(page,/not a stable release/);
 const guide=await readFile(new URL('../dist/install.md',import.meta.url),'utf8');assert.match(guide,/Never substitute the other host/);assert.match(guide,/claude auth login/);
 const config=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));assert(!config.hosting.redirects.some(x=>x.source.includes('claude-code')));
});


test('Claude website test plan is published with complete native acceptance coverage',async()=>{
 const source=await readFile(new URL('../claude-test-plan.md',import.meta.url),'utf8');
 const published=await readFile(new URL('../hosting-dist/claude-test-plan.md',import.meta.url),'utf8');
 assert.equal(published,source);
 assert.deepEqual([...source.matchAll(/^### (T\d{2}) /gm)].map(m=>m[1]),Array.from({length:22},(_,i)=>'T'+String(i+1).padStart(2,'0')));
 for(const phrase of ['the Claude version in the live installation manifest','claude auth login','Automatic binding is part of the test','NOT RUN','Two simultaneous Code chats','Stop and cancellation'])assert.ok(source.includes(phrase),phrase);
 assert.doesNotMatch(source,/\/Users\/|COORDINATOR|eval:dontdumb|artifacts\/evals/);
 const page=await readFile(new URL('claude-code/index.html',docs),'utf8');assert.match(page,/href="\/claude-test-plan\.md"/);
});
