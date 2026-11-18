import test from 'node:test';import assert from 'node:assert/strict';
import {releaseCatalog,renderReleaseLinks} from '../release-catalog.mjs';
const gate={artifact:{file:'learning-harness-codex-1.0.0-beta.33.zip',sha256:'a'.repeat(64)},candidateArtifacts:[{host:'claude',version:'1.0.0-beta.33',file:'learning-harness-claude-1.0.0-beta.33.zip',sha256:'b'.repeat(64),channel:'release-candidate',nativeAcceptance:'pending'}]};
test('customer download links use the same artifact catalog as the install manifest',()=>{const catalog=releaseCatalog(gate),html='<a href="downloads/learning-harness-codex-1.0.0-beta.19.zip" download>Codex</a><a href="/downloads/learning-harness-claude-1.0.0-beta.19.zip" download>Claude</a>';const result=renderReleaseLinks(html,catalog);assert.match(result,/codex-1.0.0-beta.33.zip/);assert.match(result,/claude-1.0.0-beta.33.zip/);assert.doesNotMatch(result,/beta.19/);assert.equal(catalog[0].version,'1.0.0-beta.33');assert.equal(catalog[1].channel,'release-candidate');});
test('release artifacts reject inconsistent host/version metadata rather than guessing',()=>{assert.throws(()=>releaseCatalog({...gate,candidateArtifacts:[{...gate.candidateArtifacts[0],version:'1.0.0-beta.4'}]}),/version/i);assert.throws(()=>releaseCatalog({...gate,artifact:{file:'../../bad.zip'}}),/artifact/i);});

import {withholdDownloads} from '../withhold-downloads.mjs';
test('withheld releases remove modern and absolute download links on any page',()=>{
 const html='<a href="downloads/learning-harness-codex-1.0.0-beta.63.zip" download>Download</a><a href="/downloads/learning-harness-claude-1.0.0-beta.63.zip">Claude</a><a href="/downloads/SHA256SUMS.txt">Checksums</a>';
 const result=withholdDownloads(html);
 assert.doesNotMatch(result,/href="\/?downloads\//);
 assert.match(result,/docs\/codex/);assert.match(result,/docs\/claude-code/);assert.match(result,/install.json/);
});
