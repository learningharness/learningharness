import {test} from 'node:test';import assert from 'node:assert/strict';import {withholdDownloads} from '../withhold-downloads.mjs';
test('withdrawal removes current host, combined trial and checksum download links',()=>{
 const result=withholdDownloads('<a class="host" href="downloads/dontdumb-codex-beta-0.1.zip" download><b>Codex</b><span>Download beta ↓</span></a><a href="downloads/dontdumb-first-run-trial.zip" download>All three</a><a href="downloads/SHA256SUMS.txt">Checksums</a>');
 assert.doesNotMatch(result,/downloads\/|\sdownload[\s>]|Download beta/);
 assert.match(result,/docs\/codex\//);assert.match(result,/docs\/agent-install\//);assert.match(result,/install.json/);
});
