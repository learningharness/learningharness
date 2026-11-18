import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
test('a failed save is reported but later state can still be saved',async()=>{
 let saved;let fail=true;
 const owner={state:{revision:1},writeChain:Promise.resolve(),storage:{set:async(_key,value)=>{if(fail){fail=false;throw Error('disk unavailable');}saved=value;}}};
 await assert.rejects(LearningEngine.prototype.persist.call(owner),/disk unavailable/);
 owner.state.revision=2;await LearningEngine.prototype.persist.call(owner);
 assert.equal(saved.revision,2);
});
