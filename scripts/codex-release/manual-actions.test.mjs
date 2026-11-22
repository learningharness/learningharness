import {uiResource} from '../desktop-runtime/ui-resource.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {manualControlCall,manualControlTools} from '../desktop-runtime/manual-actions.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('explicit coding-agent controls are separate, fail closed on identity, and expose no learner snapshot',async()=>{
 assert.deepEqual(manualControlTools.map(t=>t.name),['turn_learning_on','turn_learning_off','create_learning_moment']);let state={enabled:true,session:{paused:true,answer:'PRIVATE'},learner:{profile:'PRIVATE'}},calls=[];
 const runtime=async(method,p)=>{assert.equal(p.id,id);if(method==='status'){assert.equal(p.input.surfaceVisible,false);return state;}if(method==='command'){calls.push(p.input.action);if(p.input.action==='resume')state.session.paused=false;if(p.input.action==='disable')state.enabled=false;return {job:'job'};}return {status:'ready',result:state};};
 const result=await manualControlCall('turn_learning_on',id,runtime);assert.deepEqual(calls,['enable','resume']);assert.equal(result.structuredContent.on,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|profile|session/);
 await manualControlCall('turn_learning_off',id,runtime);assert.equal(calls.at(-1),'disable');
 state.enabled=true;const ready=await manualControlCall('create_learning_moment',id,runtime);assert.equal(ready.structuredContent.preparing,true);assert.equal(calls.at(-1),'new-moment');
 await assert.rejects(manualControlCall('turn_learning_on',null,runtime),/identity/);assert.equal(await manualControlCall('unknown',id,runtime),undefined);
});

test('only explicit On carries the sidebar resource',()=>{assert.equal(manualControlTools[0]._meta.ui.resourceUri,uiResource('codex','enable'));assert.equal(manualControlTools[1]._meta,undefined);assert.equal(manualControlTools[2]._meta,undefined);});
