import test from 'node:test';import assert from 'node:assert/strict';
import {diagnosticEntry} from '../src/diagnostics.js';
test('background recovery reasons survive allowlisting without private error content',()=>{
 for(const event of ['native_preparation_failed','native_observation_unavailable','native_readiness_unavailable']){
  const value=diagnosticEntry(event,{status:'retrying',message:'private content'});
  assert.equal(value?.status,'retrying');assert.equal(value.message,undefined);
 }
});
