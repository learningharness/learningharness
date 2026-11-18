import {test} from 'node:test';import assert from 'node:assert/strict';
import {compatibleRuntime} from './runtime-compatibility.mjs';
test('mismatched or legacy runtime never receives commands or repeated renewing pings',async()=>{
 for(const build of [undefined,'old']){let now=1,calls=[];const run=compatibleRuntime({build:'new',now:()=>now,send:async method=>{calls.push(method);return {build};}});
 await assert.rejects(run('command'),/older background/);await assert.rejects(run('command'),/older background/);assert.deepEqual(calls,['ping']);now+=90001;await assert.rejects(run('command'),/older background/);assert.deepEqual(calls,['ping','ping']);}
});
test('matching runtime is verified before forwarding commands',async()=>{let calls=[];const run=compatibleRuntime({build:'new',send:async(method)=>{calls.push(method);return method==='ping'?{build:'new'}:{ok:true};}});assert.deepEqual(await run('command'),{ok:true});assert.deepEqual(calls,['ping','command']);});
