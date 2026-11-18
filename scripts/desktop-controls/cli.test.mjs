import test from 'node:test';import assert from 'node:assert/strict';import {parseDesktopArgs,main} from './cli.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('desktop CLI is an allowlisted transport, not a shell or implicit chat selector',async()=>{
 assert.deepEqual(parseDesktopArgs(['on']),{method:'desktop-action',params:{action:'on'}});assert.deepEqual(parseDesktopArgs(['new-moment','--chat',id]),{method:'desktop-action',params:{action:'new-moment',id}});
 for(const args of [['rm'],['new-moment'],['new-moment','--chat','latest'],['on','--exec','echo'],['off','--chat',id,'--chat',id],['job','--chat',id]])assert.throws(()=>parseDesktopArgs(args));
 let calls=0;assert.match((await main(['new-moment'],()=>calls++)).error,/chat/);assert.equal(calls,0);
});
