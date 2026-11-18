import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createStore} from './state.mjs';
test('fresh setup starts Off and completion survives restart without inventing usage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-setup-'));try{
  const store=createStore(dir);assert.equal(store.read().on,false);assert(!store.read().setup?.completedAt);
  store.completeSetup();const restored=createStore(dir).read();assert(restored.setup.completedAt>0);assert.equal(restored.on,true);assert.equal(restored.ticks,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
