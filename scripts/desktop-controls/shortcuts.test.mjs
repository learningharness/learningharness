import test from 'node:test';import assert from 'node:assert/strict';import {desktopShortcutPolicy} from './shortcuts.mjs';
test('Claude helper has distinct native global keys independent of Learn or foreground app',()=>{
 const policy=desktopShortcutPolicy('claude');assert.equal(policy.scope,'global');
 assert.deepEqual(policy.combos.map(x=>[x.action,x.key]),[[1,'l'],[2,'o'],[3,'m']]);
 for(const spec of policy.combos)assert.deepEqual(spec.modifiers,['control','option','command']);
 assert.equal(new Set(policy.combos.map(x=>x.key)).size,3);
 assert.throws(()=>desktopShortcutPolicy('other'),/host/i);
});
test('Codex preserves its exact native keys and foreground-only scope',()=>{
 assert.deepEqual(desktopShortcutPolicy('codex'),{scope:'foreground',combos:[{action:1,key:'l',modifiers:['command','shift']},{action:2,key:'o',modifiers:['control','command','shift']},{action:3,key:'l',modifiers:['control','command','shift']}]});
});
