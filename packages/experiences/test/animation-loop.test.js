import test from 'node:test';import assert from 'node:assert/strict';import {animationLoop} from '../src/animation-loop.js';
test('decorative animation sleeps hidden, renders reduced motion once and cleans up timers',()=>{
 let shown=true,reduced=false,draws=0,id=0;const pending=new Map();
 const loop=animationLoop({draw:()=>draws++,visible:()=>shown,reduced:()=>reduced,setTimer:(fn,ms)=>{assert.equal(ms,50);pending.set(++id,fn);return id;},clearTimer:id=>pending.delete(id),now:()=>0});
 loop.refresh();assert.equal(draws,1);assert.equal(pending.size,1);
 shown=false;loop.refresh();assert.equal(pending.size,0);assert.equal(draws,1);
 shown=true;reduced=true;loop.refresh();assert.equal(draws,2);assert.equal(pending.size,0);
 reduced=false;loop.refresh();assert.equal(pending.size,1);loop.stop();assert.equal(pending.size,0);loop.refresh();assert.equal(draws,3);
});
