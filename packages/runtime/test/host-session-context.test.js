import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
import {createSessionContextLoader} from '../src/host-session-context.js';

async function fixture(storage={get:async()=>null,set:async()=>{}}){
 const engine=new LearningEngine({storage,gateway:{generate:async()=>{throw Error("Unexpected model call");}},capabilities:{host:"fixture",observation:{kinds:[]},model:{independent:true},surface:{experiments:false}}});await engine.load();await engine.command({action:'enable'});return engine;
}
test('opening is captured once, persisted, and kept out of the panel snapshot',async()=>{
 let saved,reads=0;const storage={get:async()=>saved??null,set:async(_,value)=>{saved=structuredClone(value);}};
 const engine=await fixture(storage);await engine.openSession('old-chat',{title:'Existing chat'});
 engine.session('old-chat').workRevision=9;engine.session('old-chat').automaticChecks=2;
 const host={getOpeningContext:async()=>{reads++;await Promise.resolve();return{id:'first',text:'Understand the sidecar system'};}};
 const ensure=createSessionContextLoader({host,engine});await Promise.all([ensure('old-chat'),ensure('old-chat')]);await ensure('old-chat');
 assert.equal(reads,1);assert.equal(engine.session('old-chat').workRevision,9);assert.equal(engine.session('old-chat').automaticChecks,2);
 assert.equal(engine.snapshot('old-chat').session.context.codingOpening,undefined);
 const reloaded=await fixture(storage);await createSessionContextLoader({host,engine:reloaded})('old-chat');
 assert.equal(reads,1);assert.equal(reloaded.session('old-chat').context.codingOpening.text,'Understand the sidecar system');
 assert.equal(reloaded.session('other').context?.codingOpening,undefined);
});
test('empty chats retry, transient failures back off, and Off does not read the opening',async()=>{
 const engine=await fixture();let calls=0,time=0;
 const host={getSession:async()=>({}),getOpeningContext:async()=>{calls++;if(calls===1)return null;if(calls===2)throw Error('unavailable');return{id:'first',text:'Investigate architecture'};}};
 const ensure=createSessionContextLoader({host,engine,now:()=>time});
 await engine.command({action:'disable'});await ensure('new-chat');assert.equal(calls,0);
 await engine.command({action:'enable'});await ensure('new-chat');await ensure('new-chat');assert.equal(calls,2);
 await ensure('new-chat');assert.equal(calls,2);time=30001;await ensure('new-chat');assert.equal(calls,3);
 assert.equal(engine.session('new-chat').context.codingOpening.id,'first');
});
