import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseManifest} from './manifest.mjs';
const commit='a'.repeat(40),version='1.0.0-beta.1001';
const artifacts=['codex','claude'].map(host=>({host,file:`learning-harness-${host}-${version}.zip`,sha256:'b'.repeat(64)}));
test('one release manifest pins both host packages to exact source and immutable URLs',()=>{
 const result=releaseManifest({version,commit,artifacts});
 assert.equal(result.status,'available');assert.equal(result.source.commit,commit);
 assert.deepEqual(result.artifacts.map(a=>a.version),[version,version]);
 for(const a of result.artifacts)assert.equal(a.url,`https://github.com/learningharness/learningharness/releases/download/v${version}/${a.packageRoot}.zip`);
 assert.equal(result.artifacts[1].nativeAcceptance,'pending');
});
test('manifest refuses missing hosts, wrong version, duplicates and invalid hashes/source',()=>{
 for(const patch of [{commit:'main'},{version:'latest'},{artifacts:artifacts.slice(0,1)},{artifacts:[artifacts[0],artifacts[0]]},{artifacts:artifacts.map(a=>({...a,sha256:'bad'}))},{artifacts:artifacts.map(a=>({...a,file:a.file.replace('1001','1002')}))}])assert.throws(()=>releaseManifest({version,commit,artifacts,...patch}));
});
