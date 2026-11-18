import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {subscriptionLogin} from '../src/subscription-login.js';
test('subscription login starts only on explicit action and reveals only the native authorization URL',async()=>{
 let spawned=0,finished=0,args;const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
 const login=subscriptionLogin({spawnProcess:(_bin,argv)=>{spawned++;args=argv;return child;},executable:'/native/claude',directory:'/empty',env:{},onComplete:async()=>finished++});
 assert.equal(spawned,0);assert.equal(login.start().pending,true);login.start();assert.equal(spawned,1);assert.deepEqual(args,['auth','login','--claudeai']);
 child.stdout.write('https://evil.example/oauth/authorize?secret=PRIVATE\naccess_token=PRIVATE\n');assert.equal(login.status().url,null);
 child.stderr.write('https://claude.ai/oauth/authorize?state=fixture&code_challenge=fixture\n');assert.match(login.status().url,/^https:\/\/claude.ai\/oauth\/authorize/);assert.doesNotMatch(JSON.stringify(login.status()),/PRIVATE/);
 child.emit('close',0);await new Promise(r=>setImmediate(r));assert.equal(finished,1);assert.equal(login.status().pending,false);assert.equal(login.status().url,null);login.close();
});
test('cancelled native login is retryable without exposing raw stderr',()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();let killed=0;child.kill=()=>killed++;
 const login=subscriptionLogin({spawnProcess:()=>child,executable:'/fake',directory:'/empty',env:{}});login.start();child.stderr.write('PRIVATE details');child.emit('close',1);assert.match(login.status().error,/not completed/);assert.doesNotMatch(JSON.stringify(login.status()),/PRIVATE/);login.start();login.close();assert.equal(killed,1);
});
