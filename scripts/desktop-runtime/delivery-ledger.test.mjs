import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDeliveryLedger} from './delivery-ledger.mjs';
async function directory(t){const dir=await mkdtemp(join(tmpdir(),'lh-delivery-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('delivery stages are independent, idempotent and never persist topic content',async t=>{
 const dir=await directory(t);let clock=10;const ledger=await createDeliveryLedger(dir,{now:()=>clock});
 const topic='task:PRIVATE lesson outcome';
 await ledger.record('session',topic,'prepared');
 assert.deepEqual(ledger.get('session',topic).timestamps,{prepared:10});
 clock=20;await ledger.record('session',topic,'attempted');clock=30;await ledger.record('session',topic,'attempted');
 assert.equal(ledger.get('session',topic).timestamps.attempted,20);
 assert.equal(ledger.get('session',topic).timestamps.acknowledged,undefined);
 for(const stage of ['acknowledged','opened','practiced']){clock++;await ledger.record('session',topic,stage);}
 const saved=await createDeliveryLedger(dir);assert.deepEqual(saved.get('session',topic),ledger.get('session',topic));
 assert.equal((await readFile(join(dir,'delivery-ledger.json'),'utf8')).includes('PRIVATE'),false);
 assert.equal((await stat(join(dir,'delivery-ledger.json'))).mode&0o077,0);
 await assert.rejects(ledger.record('session',topic,'delivered'),/stage/);
});
test('serialized writes preserve concurrent independent stages and do not imply earlier stages',async t=>{
 const ledger=await createDeliveryLedger(await directory(t),{now:()=>5});
 await Promise.all(['practiced','attempted','opened'].map(stage=>ledger.record('a','key',stage)));
 assert.deepEqual(ledger.get('a','key').timestamps,{practiced:5,attempted:5,opened:5});
 assert.equal(ledger.get('b','key'),undefined);
});
test('pending preparation becomes interrupted on restart and needs explicit retry permission',async t=>{
 const dir=await directory(t),ledger=await createDeliveryLedger(dir,{now:()=>10});
 assert.equal((await ledger.beginPreparation('a','key',{maxAttempts:2})).attempts,1);
 const restarted=await createDeliveryLedger(dir,{now:()=>20});
 assert.equal(restarted.get('a','key').preparation.status,'interrupted');
 assert.equal(await restarted.beginPreparation('a','key',{maxAttempts:2}),null);
 const retry=await restarted.beginPreparation('a','key',{maxAttempts:2,allowInterruptedRetry:true});assert.equal(retry.attempts,2);
 await restarted.failPreparation('a','key',{attempt:2,retryAt:50,reason:'generation-failed'});
 assert.equal(await restarted.beginPreparation('a','key',{maxAttempts:99}),null,'persisted cap cannot be expanded by a restart');
});
test('known failures retain retry deadline and attempt cap across restart',async t=>{
 const dir=await directory(t);let clock=0,ledger=await createDeliveryLedger(dir,{now:()=>clock});
 await ledger.beginPreparation('a','key',{maxAttempts:2});
 await ledger.failPreparation('a','key',{attempt:1,retryAt:100,reason:'work-changed'});
 ledger=await createDeliveryLedger(dir,{now:()=>clock});clock=99;assert.equal(await ledger.beginPreparation('a','key',{maxAttempts:2}),null);
 clock=100;assert.equal((await ledger.beginPreparation('a','key',{maxAttempts:2})).attempts,2);
 await ledger.finishPreparation('a','key',{attempt:1,status:'prepared'});assert.equal(ledger.get('a','key').preparation.status,'pending','late prior attempt cannot settle newer work');
 await ledger.finishPreparation('a','key',{attempt:2,status:'prepared'});
 assert.equal(ledger.get('a','key').timestamps.prepared,100);assert.equal(ledger.get('a','key').timestamps.attempted,undefined);
});
test('bounded history drops oldest completed identities and preserves active reservations',async t=>{
 const ledger=await createDeliveryLedger(await directory(t),{maxEntries:2});
 await ledger.beginPreparation('active','key',{maxAttempts:1});await ledger.record('old','key','opened');await ledger.record('new','key','prepared');
 assert.equal(ledger.list().length,2);assert.equal(ledger.get('old','key'),undefined);assert.equal(ledger.get('active','key').preparation.status,'pending');
});
test('malformed history fails closed without overwriting the file',async t=>{
 const dir=await directory(t),file=join(dir,'delivery-ledger.json');await writeFile(file,'{broken');
 await assert.rejects(createDeliveryLedger(dir),/preserved/);assert.equal(await readFile(file,'utf8'),'{broken');
});
test('exact invitation aliases survive newer runtime identities without crossing sessions',async t=>{
 const dir=await directory(t),ledger=await createDeliveryLedger(dir,{now:()=>7}),id='12345678-1234-4234-8234-123456789abc',other='22345678-1234-4234-8234-123456789abc';
 await ledger.record('a','old topic','prepared',{invitationId:id});await ledger.record('a','new topic','prepared',{invitationId:other});
 await ledger.recordInvitation('a',id,'acknowledged');
 assert.equal(ledger.findInvitation('a',id).timestamps.acknowledged,7);assert.equal(ledger.findInvitation('a',other).timestamps.acknowledged,undefined);
 await assert.rejects(ledger.recordInvitation('b',id,'opened'),/unavailable/);
 await assert.rejects(ledger.record('a','old topic','prepared',{invitationId:'guess'}),/identity/);
 await assert.rejects(ledger.record('a','new topic','attempted',{content:'private'}),/metadata/);
 await assert.rejects(ledger.record('a','new topic','prepared',{invitationId:id}),/another/);
 const restarted=await createDeliveryLedger(dir);assert.equal(restarted.findInvitation('a',id).timestamps.acknowledged,7);
});
test('invitation aliases are bounded without losing the session/runtime identity',async t=>{
 const ledger=await createDeliveryLedger(await directory(t));
 for(let index=0;index<33;index++)await ledger.record('a','key','prepared',{invitationId:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`});
 assert.equal(ledger.get('a','key').invitationIds.length,32);assert.equal(ledger.findInvitation('a','00000000-0000-4000-8000-000000000000'),undefined);assert.ok(ledger.findInvitation('a','00000000-0000-4000-8000-000000000032'));
});
test('unsafe file links and schema content fail closed without replacing existing evidence',async t=>{
 const dir=await directory(t),outside=join(dir,'other.json');await writeFile(outside,'original');const {symlink}=await import('node:fs/promises');await symlink(outside,join(dir,'delivery-ledger.json'));
 await assert.rejects(createDeliveryLedger(dir),/preserved/);assert.equal(await readFile(outside,'utf8'),'original');
});
