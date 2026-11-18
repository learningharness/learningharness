import test from 'node:test';import assert from 'node:assert/strict';import {createInvitationPublisher} from './invitation-publisher.mjs';import {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
test('an intentional no-value decision is durable silence, not an automatic paid retry',async()=>{
 let chain,calls=0;const session={goals:{list:[{outcome:'Known topic',insight:'Already explained.'}],snapshot:[]},workSelection:{task:{id:'task1'}}};const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{calls++;return false;},record:()=>{throw Error('Not a provider failure')}};
 const create=()=>createInvitationPublisher({getEngine:()=>engine,readChain:()=>chain,writeChain:(_,next)=>{chain=next},projectRuntimeInvitation,retryMs:0});let sync=create();sync('chat');await new Promise(r=>setImmediate(r));assert.equal(chain.status,'silent');sync=create();for(let i=0;i<4;i++)sync('chat');await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 session.workSelection.task.id='task2';sync('chat');await new Promise(r=>setImmediate(r));assert.equal(calls,2,'a new task may justify a new decision');
});
