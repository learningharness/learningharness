import test from 'node:test';import assert from 'node:assert/strict';
import {uiResource} from './ui-resource.mjs';
test('UI identities differ by host, view and package version',()=>{
 const uri=uiResource('codex','invitation','1.0.0-beta.69');
 assert.notEqual(uri,uiResource('codex','invitation','1.0.0-beta.68'));
 assert.notEqual(uri,uiResource('claude','invitation','1.0.0-beta.69'));
 assert.notEqual(uri,uiResource('codex','learn','1.0.0-beta.69'));
 assert.match(uri,/1\.0\.0-beta\.69/);
});
test('old cards resolve to current UI without crossing host boundaries',async()=>{
 const {resolveUIResource}=await import('./ui-resource.mjs');
 assert.equal(resolveUIResource('codex','ui://learning-harness/v19/invitation'),uiResource('codex','invitation'));
 assert.equal(resolveUIResource('claude','ui://learning-harness/claude/v1/learn'),uiResource('claude','learn'));
 assert.equal(resolveUIResource('codex',uiResource('codex','learn','1.0.0-beta.68')),uiResource('codex','learn'));
 assert.equal(resolveUIResource('codex',uiResource('claude','learn')),null);
 assert.equal(resolveUIResource('codex','ui://private-trial'),null);
});
