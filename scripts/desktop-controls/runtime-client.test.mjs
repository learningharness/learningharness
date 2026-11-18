import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runtimeCall} from './runtime-client.mjs';
test('Claude commands reach only the explicitly configured installed socket',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-shortcuts-'));const received=[];
 const server=createServer(socket=>{let body='';socket.on('data',chunk=>body+=chunk);socket.on('end',()=>{received.push(JSON.parse(body));socket.end(JSON.stringify({result:{enabled:false}}));});});
 await new Promise(resolve=>server.listen(join(root,'core.sock'),resolve));
 try{assert.deepEqual(await runtimeCall('desktop-action',{action:'off'},{env:{LEARNING_HARNESS_HOST:'claude',LEARNING_HARNESS_DATA_DIR:root}}),{enabled:false});assert.deepEqual(received,[{method:'desktop-action',params:{action:'off'}}]);}
 finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
test('unknown hosts and unconfigured Claude roots fail before connecting',async()=>{
 await assert.rejects(runtimeCall('desktop-status',{}, {env:{LEARNING_HARNESS_HOST:'bad'}}),/host/i);
 await assert.rejects(runtimeCall('desktop-status',{}, {env:{LEARNING_HARNESS_HOST:'claude'}}),/explicit/i);
});
test('absent Claude runtime gives explicit first-use guidance without starting it',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lh-missing-runtime-'));
 try{await assert.rejects(runtimeCall('desktop-status',{}, {env:{LEARNING_HARNESS_HOST:'claude',LEARNING_HARNESS_DATA_DIR:root}}),/Open Claude and open Learn once/);}
 finally{await rm(root,{recursive:true,force:true});}
});
