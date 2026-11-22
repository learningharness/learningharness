import test from 'node:test';import assert from 'node:assert/strict';
import {openPreparedJob,preparedPlacement} from './prepared-opening.mjs';
test('saved visual lessons route to sidebar while only bounded probes qualify inline',()=>{
 const target={id:'card'},session={preparedLessons:{card:{moment:{id:'q',kind:'predict',question:'What happens?',choices:['A','B']}}}};
 assert.equal(preparedPlacement(session,target),true);
 session.preparedLessons.card.moment.kind='explain';assert.equal(preparedPlacement(session,target),false);
 assert.equal(preparedPlacement(session,{id:'missing'}),false);
});
test('ready local opening returns its snapshot without requiring a second host request',async()=>{
 const settled=[];const snapshot={session:{moment:{id:'q'}}};
 const result=await openPreparedJob({id:'chat',jobs:{create:async()=>{},settle:async(id,value)=>{settled.push(value);}},open:async()=>snapshot});
 assert.equal(result.status,'ready');assert.deepEqual(result.result,snapshot);assert.equal(settled[0].status,'ready');assert.equal(typeof result.job,'string');
});
test('queued opening keeps a recoverable job instead of blocking the host',async()=>{
 let finish;const settled=[];
 const result=await openPreparedJob({id:'chat',waitMs:0,jobs:{create:async()=>{},settle:async(id,value)=>{settled.push(value);}},open:()=>new Promise(resolve=>finish=resolve)});
 assert.equal(result.status,undefined);assert.equal(typeof result.job,'string');finish({ok:true});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(settled[0].status,'ready');
});
test('opening errors remain explicit and journaled',async()=>{
 const settled=[];const result=await openPreparedJob({id:'chat',jobs:{create:async()=>{},settle:async(id,value)=>settled.push(value)},open:async()=>{throw Error('Saved item unavailable')}});
 assert.equal(result.status,'error');assert.equal(result.error,'Saved item unavailable');assert.equal(settled[0].status,'error');
});
test('post-open failures are journaled so a retry does not wait forever',async()=>{
 const settled=[];const result=await openPreparedJob({id:'chat',jobs:{create:async()=>{},settle:async(id,value)=>settled.push(value)},open:async()=>({ok:true}),afterOpen:async()=>{throw Error('Receipt unavailable')}});
 assert.equal(result.status,'error');assert.equal(settled[0].status,'error');
});
