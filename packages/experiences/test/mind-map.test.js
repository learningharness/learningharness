import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMindMap, mindMapText } from '../src/mind-map.js';
const map = { title: 'A retry decision', root: { label: 'Failure', children: [{ label: 'Temporary', children: [{ label: 'May clear between attempts' }] }, { label: 'Authentication', children: [{ label: 'Requires changed credentials' }] }] } };
test('mind maps are bounded declarative trees with a readable plain-text fallback', () => {
  const valid = validateMindMap(map); assert.equal(valid.root.children[0].children[0].label, 'May clear between attempts');
  assert.equal(mindMapText(valid), 'Failure\n  Temporary\n    May clear between attempts\n  Authentication\n    Requires changed credentials');
  assert.notEqual(valid, map);
});
test('malformed maps, excessive nodes/depth, scripts and terminal control characters are rejected', () => {
  const nested = label => ({ label, children: [] }); let deep = nested('leaf');
  for (let i = 0; i < 5; i++) deep = { label: `level ${i}`, children: [deep] };
  for (const value of [{ ...map, script: 'alert(1)' }, { ...map, root: deep }, { ...map, root: { label: '\u001b[31m' } }, { ...map, root: { label: 'root', children: Array.from({ length: 20 }, (_, i) => nested(String(i))) } }, { ...map, root: { label: '' } }, { ...map, root: { label: 'root', children: [{ label: '   ' }] } }, { ...map, root: { label: 'root', children: null } }, { ...map, root: { label: 'root', url: 'https://example.com' } }]) assert.throws(() => validateMindMap(value));
});

test('fit shows the entire spatial map at narrow and wide panel sizes',async()=>{
 const {mindMapFitScale}=await import('../src/mind-map.js');
 for(const [width,height] of [[270,440],[318,440],[680,440],[900,900]]){
  const scale=mindMapFitScale(600,860,width,height);
  assert(scale<=1);assert(600*scale<=width);assert(860*scale<=height);
 }
 assert.equal(mindMapFitScale(200,100,500,400),1,'small maps do not get enlarged automatically');
});
