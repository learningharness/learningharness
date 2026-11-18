import test from 'node:test';import assert from 'node:assert/strict';
import {GenerationQueue} from '../src/generation-queue.js';
test('one foreground call can start beside background work; each lane stays bounded',async()=>{
 const q=new GenerationQueue(),order=[];let releaseBackground,releaseForeground;
 const backgroundHeld=new Promise(r=>releaseBackground=r),foregroundHeld=new Promise(r=>releaseForeground=r);
 const a=q.run(async()=>{order.push('background');await backgroundHeld;},true);
 await new Promise(r=>setImmediate(r));
 const b=q.run(async()=>order.push('next-background'),true);
 const c=q.run(async()=>{order.push('learner');await foregroundHeld;});
 const d=q.run(async()=>order.push('next-learner'));
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(order,['background','learner'],'learner does not wait for active preparation');
 releaseForeground();await c;await d;assert.deepEqual(order,['background','learner','next-learner']);
 releaseBackground();await Promise.all([a,b]);assert.equal(order.at(-1),'next-background');
 await assert.rejects(q.run(async()=>{throw Error('failed');}),/failed/);
 assert.equal(await q.run(async()=>42),42);
});
import {LearningEngine} from '../src/learning-engine.js';
async function fixture(){
 const order=[];let release,started;const held=new Promise(r=>release=r),begun=new Promise(r=>started=r);
 const engine=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async({parentSessionId})=>{order.push(parentSessionId);if(parentSessionId==='active'){started();await held;}return{text:'{}',usage:{input:2,output:1}};}},capabilities:{host:'fixture',observation:{kinds:[]},model:{independent:true},surface:{experiments:false}}});
 await engine.load();await engine.command({action:'enable'});
 const run=(id,background)=>engine.generateStep({role:'orchestrator',intent:'ask',parentSessionId:id,model:{providerID:'fixture',modelID:'fixture'},prompt:'fixture',background});
 const active=run('active',true);await begun;return{engine,run,active,release,order};
}
test('engine prioritizes a different chat learner and accounts usage only to each owner',async()=>{
 const f=await fixture(),background=f.run('background',true),foreground=f.run('foreground',false);
 await foreground;assert.deepEqual(f.order,['active','foreground']);f.release();await Promise.all([f.active,background]);assert.deepEqual(f.order,['active','foreground','background']);
 for(const id of f.order)assert.equal(f.engine.session(id).usage.input,2);
 assert.equal(f.engine.state.usage.input,6);
});
test('turning Off rejects waiting model work before provider dispatch',async()=>{
 const f=await fixture();const active=f.active.catch(e=>e),waiting=f.run('queued',true).catch(e=>e);
 await f.engine.command({action:'disable'});f.release();assert.match((await waiting).message,/stopped|paused/i);await active;
 assert.deepEqual(f.order,['active']);assert.equal(f.engine.session('queued').usage.calls,0);
});
test('the two lanes never overlap calls belonging to the same owner',async()=>{
 const q=new GenerationQueue();let release,foreground=false;const held=new Promise(r=>release=r);
 const a=q.run(()=>held,true,'same');const b=q.run(()=>{foreground=true;},false,'same');
 await new Promise(r=>setImmediate(r));assert.equal(foreground,false);release();await Promise.all([a,b]);assert.equal(foreground,true);
});
