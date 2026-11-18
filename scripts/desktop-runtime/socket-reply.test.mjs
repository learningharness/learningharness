import test from 'node:test';import assert from 'node:assert/strict';
import {replyToSocket} from './socket-reply.mjs';
test('request errors return JSON on a real socket-shaped return value',async()=>{
 const output=[];const socket={end(text){output.push(JSON.parse(text));return this;}};
 await replyToSocket(socket,async()=>{throw Error('unavailable');});await replyToSocket(socket,async()=>({on:false}));
 assert.deepEqual(output,[{error:'unavailable'},{result:{on:false}}]);
});
