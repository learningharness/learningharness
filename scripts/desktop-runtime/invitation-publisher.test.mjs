import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createInvitationPublisher} from './invitation-publisher.mjs';
import {createDeliveryLedger} from './delivery-ledger.mjs';
import {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'lh-publisher-ledger-'));t.after(()=>rm(dir,{recursive:true,force:true}));let clock=0,chain,calls=0;
 const session={goals:{list:[{outcome:'Private topic',insight:'Grounded teaching'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,record:()=>{},prepareOpportunity:async()=>{calls++;throw Error('Temporary provider failure');}};
 return {dir,engine,session,get calls(){return calls;},get chain(){return chain;},set chain(value){chain=value;},set clock(value){clock=value;},ledger:()=>createDeliveryLedger(dir,{now:()=>clock}),publisher:ledger=>createInvitationPublisher({getEngine:()=>engine,readChain:()=>chain,writeChain:(_,value)=>{chain=value;},projectRuntimeInvitation,now:()=>clock,retryMs:100,maxAttempts:2,deliveryLedger:ledger})};
}
test('preparation retry deadline and cap survive publisher and runtime restart',async t=>{
 const f=await fixture(t);let ledger=await f.ledger(),sync=f.publisher(ledger);await sync('chat');assert.equal(f.calls,1);
 ledger=await f.ledger();sync=f.publisher(ledger);f.clock=99;await sync('chat');assert.equal(f.calls,1);
 f.clock=100;await sync('chat');assert.equal(f.calls,2);
 ledger=await f.ledger();sync=f.publisher(ledger);f.clock=1000;await sync('chat');assert.equal(f.calls,2);assert.equal(ledger.get('chat','null:Private topic').preparation.attempts,2);
});
test('an interrupted paid preparation is exposed and not automatically replayed',async t=>{
 const f=await fixture(t);let ledger=await f.ledger();await ledger.beginPreparation('chat','null:Private topic',{maxAttempts:2});
 ledger=await f.ledger();await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(ledger.get('chat','null:Private topic').preparation.status,'interrupted');assert.equal(f.chain,undefined);
});
test('existing prepared chains are bound into the ledger after restart without generation or delivery claims',async t=>{
 const f=await fixture(t),ledger=await f.ledger(),invitationId='12345678-1234-4234-8234-123456789abc';
 f.chain={runtime:true,status:'ready',taskId:null,runtimeKey:'null:Private topic',preparedTarget:{id:invitationId,kind:'goal'}};
 await f.publisher(ledger)('chat');assert.equal(f.calls,0);
 const entry=ledger.findInvitation('chat',invitationId);assert.equal(entry.timestamps.prepared,0);assert.equal(entry.timestamps.attempted,undefined);assert.equal(entry.timestamps.acknowledged,undefined);
});
test('fresh preparation records only prepared state and exact invitation binding',async t=>{
 const f=await fixture(t),ledger=await f.ledger();f.engine.prepareOpportunity=async()=>true;
 await f.publisher(ledger)('chat');assert.equal(f.chain.status,'ready');const entry=ledger.findInvitation('chat',f.chain.preparedTarget.id);
 assert.deepEqual(entry.timestamps,{prepared:0});assert.equal(entry.preparation.status,'prepared');
});
test('stale prepared work retracts readiness and retains its refresh budget across restart',async t=>{
 const f=await fixture(t);let ledger=await f.ledger(),current=true;f.engine.preparedOpportunityCurrent=()=>current;f.engine.prepareOpportunity=async()=>{current=true;return true;};
 await f.publisher(ledger)('chat');current=false;
 await f.publisher(ledger)('chat');assert.equal(f.chain.status,'stale');
 ledger=await f.ledger();f.clock=99;await f.publisher(ledger)('chat');assert.equal(f.chain.status,'stale');
 f.clock=100;await f.publisher(ledger)('chat');assert.equal(f.chain.status,'ready');assert.equal(ledger.get('chat','null:Private topic').preparation.attempts,2);
 current=false;await f.publisher(ledger)('chat');ledger=await f.ledger();f.clock=1000;await f.publisher(ledger)('chat');assert.equal(f.chain.status,'stale');
});
test('switching Off while reserving prevents generation and leaves an interrupted reservation',async t=>{
 const f=await fixture(t),ledger=await f.ledger(),begin=ledger.beginPreparation;
 ledger.beginPreparation=async(...args)=>{const reservation=await begin(...args);f.engine.state.enabled=false;return reservation;};
 await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(ledger.get('chat','null:Private topic').preparation.status,'interrupted');
});
test('a post-generation ledger failure cannot become permission for automatic paid replay',async t=>{
 const f=await fixture(t),ledger=await f.ledger(),finish=ledger.finishPreparation;let calls=0;
 f.engine.prepareOpportunity=async()=>{calls++;return true;};
 ledger.finishPreparation=async(...args)=>{if(args[2].status==='prepared')throw Error('Disk temporarily unavailable');return finish(...args);};
 await f.publisher(ledger)('chat');assert.equal(f.chain,undefined);assert.equal(ledger.get('chat','null:Private topic').preparation.status,'interrupted');
 f.clock=1000;await f.publisher(ledger)('chat');assert.equal(calls,1);
});
test('durable intentional silence remains silent even without the old projection chain',async t=>{
 const f=await fixture(t);let calls=0;f.engine.prepareOpportunity=async()=>{calls++;return false;};let ledger=await f.ledger();await f.publisher(ledger)('chat');
 f.chain=undefined;ledger=await f.ledger();await f.publisher(ledger)('chat');assert.equal(calls,1);assert.equal(ledger.get('chat','null:Private topic').preparation.status,'silent');assert.deepEqual(ledger.get('chat','null:Private topic').timestamps,{});
});
test('crash after persisted engine content recovers its reserved identity without paid replay',async t=>{
 for(const completed of [false,true]){
  const f=await fixture(t);let ledger=await f.ledger();const invitationId='12345678-1234-4234-8234-123456789abc';
  await ledger.beginPreparation('chat','null:Private topic',{maxAttempts:2,invitationId});
  f.session.preparedLessons={[invitationId]:{moment:{invitationId,lesson:{sections:[]}}}};
  if(completed)await ledger.finishPreparation('chat','null:Private topic',{attempt:1,status:'prepared'});
  ledger=await f.ledger();f.engine.preparedOpportunityCurrent=(_,target)=>target.id===invitationId;
  await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(f.chain.preparedTarget.id,invitationId);assert.equal(ledger.findInvitation('chat',invitationId).preparation.status,'prepared');
 }
});
test('restart does not advertise stale or absent engine cache as prepared content',async t=>{
 const f=await fixture(t);let ledger=await f.ledger();const invitationId='12345678-1234-4234-8234-123456789abc';
 await ledger.beginPreparation('chat','null:Private topic',{maxAttempts:2,invitationId});f.session.preparedLessons={[invitationId]:{moment:{invitationId}}};
 ledger=await f.ledger();f.engine.preparedOpportunityCurrent=()=>false;await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(f.chain,undefined);
});
test('ordinary polling of an already-bound prepared chain avoids ledger writes',async t=>{
 const f=await fixture(t),ledger=await f.ledger(),invitationId='12345678-1234-4234-8234-123456789abc';
 f.chain={runtime:true,status:'ready',taskId:null,runtimeKey:'null:Private topic',preparedTarget:{id:invitationId,kind:'goal'}};
 await f.publisher(ledger)('chat');let writes=0;ledger.record=async()=>{writes++;};await f.publisher(ledger)('chat');assert.equal(writes,0);
});
test('a due review alone never prepares, advertises or reserves paid learning',async t=>{
 const f=await fixture(t),ledger=await f.ledger();f.session.goals=null;f.session.reviewOffer={id:'due-review',objective:'Revisit previous reasoning'};
 await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(f.chain,undefined);assert.deepEqual(ledger.list(),[]);
});
test('legacy automatic review readiness is retracted while an actual goal can still prepare',async t=>{
 const f=await fixture(t),ledger=await f.ledger();f.session.goals=null;f.session.reviewOffer={id:'due-review',objective:'Revisit previous reasoning'};
 f.chain={runtime:true,status:'ready',taskId:null,runtimeKey:'null:due-review',preparedTarget:{id:'12345678-1234-4234-8234-123456789abc',kind:'review'}};
 await f.publisher(ledger)('chat');assert.equal(f.calls,0);assert.equal(f.chain.status,'stale');assert.deepEqual(ledger.list(),[]);
 f.session.goals={list:[{outcome:'Actual work',insight:'A concrete mechanism'}],snapshot:[]};await f.publisher(ledger)('chat');assert.equal(f.calls,1);
});
