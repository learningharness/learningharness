import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchSelector} from './watch-selection.mjs';
test('expired watches do not consume active chat slots and eligible chats rotate',()=>{
 const choose=createWatchSelector({now:()=>1000000,limit:2});
 const watches=[...Array.from({length:30},(_,i)=>({id:`old${i}`,at:0})),...['a','b','c'].map(id=>({id,at:1000000}))];
 assert.deepEqual(choose(watches).map(w=>w.id),['a','b']);assert.deepEqual(choose(watches).map(w=>w.id),['c','a']);
 assert.deepEqual(choose([{id:'bad',at:NaN}]),[]);
});
