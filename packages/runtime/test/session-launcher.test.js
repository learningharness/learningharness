import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {LearningEngine} from '../src/learning-engine.js';import {createStore} from '../../../scripts/desktop-runtime/state.mjs';
test('Claude launcher preference is saved independently of learning and survives restart',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'lh-launcher-settings-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const updates=[];
 const make=()=>{const store=createStore(dir);return new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{throw Error('No generation');}},capabilities:{host:'claude',observation:{kinds:[]},model:{independent:true},surface:{}},launcherSettings:store,emit:async(type,data)=>updates.push({type,data})});};
 let engine=make();await engine.load();assert.equal(engine.snapshot().settings.showSessionLauncher,false);
 for(const value of [true,false]){updates.length=0;const before=structuredClone(engine.state);await engine.command({action:'set-session-launcher',value});assert.deepEqual(engine.state,before);assert.deepEqual(updates,[{type:'updated',data:{reason:'session-launcher-settings'}}]);engine=make();await engine.load();assert.equal(engine.snapshot().settings.showSessionLauncher,value);assert.equal(engine.snapshot().enabled,false);assert.deepEqual(engine.state.sessions,{});assert.equal(createStore(dir).read().on,false);}
 const otherConnection=createStore(dir);otherConnection.setSessionLauncher(true);assert.equal(engine.snapshot().settings.showSessionLauncher,true);otherConnection.set(false);assert.equal(engine.snapshot().settings.showSessionLauncher,true);otherConnection.setSessionLauncher(false);assert.equal(engine.snapshot().settings.showSessionLauncher,false);
 await assert.rejects(engine.command({action:'set-session-launcher',value:'true'}),/on or off/);
});
test('other hosts cannot change a Claude launcher preference',async()=>{
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{}},capabilities:{host:'codex',observation:{kinds:[]},model:{independent:true},surface:{}}});await engine.load();
 await assert.rejects(engine.command({action:'set-session-launcher',value:true}),/Claude/);assert.equal(engine.snapshot().settings.showSessionLauncher,undefined);
});
