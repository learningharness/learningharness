import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
function fixture(saved){let value=saved;return new LearningEngine({storage:{get:async()=>value,set:async(_,next)=>{value=structuredClone(next);}},gateway:{generate:async()=>{throw Error('No generation expected');}},capabilities:{observation:{kinds:[]},model:{independent:true},surface:{}}});}
test('new learners start with a ten-million overall usage alert; saved limits survive enable and restart',async()=>{
 const fresh=fixture();await fresh.load();await fresh.command({action:'enable'});assert.deepEqual(fresh.snapshot().limits,{session:1000000,total:10000000});
 const returning=fixture({version:1,sessions:{},settings:{},limits:{session:12345,total:200000}});await returning.load();await returning.command({action:'enable'});assert.deepEqual(returning.snapshot().limits,{session:12345,total:200000});
});

test('previous default limits migrate and usage dismissal survives reload',async()=>{const engine=fixture({version:1,sessions:{},settings:{},limits:{session:50000,total:2000000}});await engine.load();assert.deepEqual(engine.snapshot().limits,{session:1000000,total:10000000});await engine.command({action:'dismiss-usage-alert',sessionID:'chat-a'});assert.equal(engine.session('chat-a').usageAlertDismissed,true);await engine.load();assert.equal(engine.session('chat-a').usageAlertDismissed,true);});
