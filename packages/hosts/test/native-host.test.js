import test from 'node:test';
import assert from 'node:assert/strict';
import {identityFrom,assertNativeHost} from '../src/native-host.js';
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
test('identity must be exact, unambiguous and never inferred from active chat',()=>{
 assert.equal(identityFrom({thread_id:a,threadId:a}),a);
 assert.equal(identityFrom({session_id:b}),b);
 assert.equal(identityFrom({activeChat:a}),null);
 assert.throws(()=>identityFrom({thread_id:a,session_id:b}),/Conflicting/);
 assert.equal(identityFrom({session_id:'../../state'}),null);
});
test('native contract rejects incomplete adapters before runtime startup',()=>{
 assert.throws(()=>assertNativeHost({id:'claude'}),/getSession/);
});
