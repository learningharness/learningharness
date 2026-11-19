import test from 'node:test';
import assert from 'node:assert/strict';
import {isNativeCommand} from './command-policy.mjs';
test('native transport admits placement changes and exact-step expansion cursors',()=>{
 for(const action of ['set-presentation','set-inline-questions','set-presentation-cursor','save-draft','submit','disable'])assert.equal(isNativeCommand(action),true,action);
 for(const action of ['arbitrary-command','__proto__',null,undefined,{}])assert.equal(isNativeCommand(action),false);
});
