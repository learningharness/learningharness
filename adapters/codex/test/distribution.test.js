import test from 'node:test';
import assert from 'node:assert/strict';
import { privateOrigin, acceptsHost, acceptsOrigin } from '../src/access.js';
import { parseArgs, runningCompanion, openBrowser } from '../cli/launch.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findCodex } from '../src/rpc.js';
test('phone access allows only an explicitly configured HTTPS origin and exact host', () => {
  const local='http://127.0.0.1:1234', remote=privateOrigin('https://desktop.example.ts.net:10000');
  assert.equal(acceptsHost('desktop.example.ts.net:10000',local,remote),true);
  assert.equal(acceptsHost('evil.example',local,remote),false);
  assert.equal(acceptsOrigin('https://evil.example',local,remote),false);
  assert.equal(acceptsOrigin(remote,local,remote),true);
  assert.equal(acceptsOrigin(local,local,remote),true);
  for(const origin of ['http://host','https://a:b@host','https://host/path','https://host/#secret','https://host/?x=1']) assert.throws(()=>privateOrigin(origin));
});
test('launcher parses project paths without shell interpretation and rejects malformed flags', () => {
  assert.equal(parseArgs(['--no-open']).project,null);
  assert.equal(parseArgs(['--mobile-origin','https://host:10000','--port','15447']).port,15447);
  for(const args of [['--port','0'],['--port'],['--mobile-origin','http://host'],['--unknown'],['one','two']]) assert.throws(()=>parseArgs(args));
  assert.ok(parseArgs(['/tmp/project with spaces; $(noop)']).project.endsWith('project with spaces; $(noop)'));
});
test('stale control file cannot cause credentials to be forwarded to a remote host', async () => {
  const directory=await mkdtemp(join(tmpdir(),'dd-distribution-'));
  try { await writeFile(join(directory,'companion.json'),JSON.stringify({url:'https://example.com/#'+'a'.repeat(48)})); assert.equal(await runningCompanion(directory),null); }
  finally { await rm(directory,{recursive:true,force:true}); }
});
test('Codex discovery gives a useful error and respects an explicit executable', () => {
  assert.equal(findCodex({DONTDUMB_CODEX_BIN:'/custom/codex'},'linux'),'/custom/codex');
  assert.throws(()=>findCodex({PATH:'/not/a/real/path'},'linux'),/Codex was not found/);
});
test('Finder installer copies the plugin and installs it without user terminal input', {skip:process.platform!=='darwin'}, async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdir, cp, chmod, readFile } = await import('node:fs/promises');
  const temp=await mkdtemp(join(tmpdir(),'dd-finder-installer-'));
  try {
    const source=join(temp,'download with spaces'); await mkdir(join(source,'bin'),{recursive:true});
    await cp(new URL('../plugin/bin/install-macos',import.meta.url),join(source,'bin/install-macos'));
    await writeFile(join(source,'plugin.json'),'fixture');
    const fake=join(temp,'fake-codex'); const opener=join(temp,'fake-open');
    await writeFile(fake,'#!/bin/zsh\nprint -r -- "$*" >> "$HOME/codex-calls"\n');await chmod(fake,0o755);
    await writeFile(opener,'#!/bin/zsh\nprint -r -- "$*" >> "$HOME/open-calls"\n');await chmod(opener,0o755);
    execFileSync('/bin/zsh',[join(source,'bin/install-macos')],{env:{...process.env,HOME:temp,DONTDUMB_CODEX_BIN:fake,DONTDUMB_OPEN_BIN:opener}});
    assert.equal(await readFile(join(temp,'.local/share/learning-harness/plugins/0.1.0-beta.16/plugin.json'),'utf8'),'fixture');
    assert.match(await readFile(join(temp,'codex-calls'),'utf8'),/plugin add dontdumb@dontdumb-beta/);
    assert.equal((await readFile(join(temp,'open-calls'),'utf8')).trim(),'codex://plugins/dontdumb@dontdumb-beta');
  } finally {await rm(temp,{recursive:true,force:true});}
});

test('browser opening passes the private URL as one argument and reports failure', async () => {
  const {EventEmitter}=await import('node:events');
  let invocation;
  await openBrowser('http://127.0.0.1:1234/#fixture',{platform:'darwin',spawnProcess:(...args)=>{invocation=args;const child=new EventEmitter();child.kill=()=>{};queueMicrotask(()=>child.emit('exit',0));return child;}});
  assert.deepEqual(invocation.slice(0,2),['open',['http://127.0.0.1:1234/#fixture']]);
  await assert.rejects(openBrowser('http://127.0.0.1:1234/#fixture',{spawnProcess:()=>{const child=new EventEmitter();child.kill=()=>{};queueMicrotask(()=>child.emit('error',new Error('blocked')));return child;}}),/browser could not open/);
});
