import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createDeliveryLedger} from './delivery-ledger.mjs';
import {recordDeliveryReceipt,recordPracticeReceipt,recordOpeningReceipt} from './delivery-receipts.mjs';
const chat='12345678-1234-4234-8234-123456789abc',other='22345678-1234-4234-8234-123456789abc',invitation='32345678-1234-4234-8234-123456789abc';
test('frame receipt is scoped to saved invitation and cannot manufacture opening or practice',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lh-receipt-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const ledger=await createDeliveryLedger(directory);await ledger.record(chat,'key','prepared',{invitationId:invitation});
 await recordDeliveryReceipt(ledger,{id:chat,invitationId:invitation,stage:'attempted'});
 assert.equal(ledger.findInvitation(chat,invitation).timestamps.acknowledged,undefined);
 await assert.rejects(recordDeliveryReceipt(ledger,{id:other,invitationId:invitation,stage:'acknowledged'}),/unavailable/);
 for(const stage of ['opened','practiced','prepared'])await assert.rejects(recordDeliveryReceipt(ledger,{id:chat,invitationId:invitation,stage}),/stage/);
 await recordDeliveryReceipt(ledger,{id:chat,invitationId:invitation,stage:'acknowledged'});await recordDeliveryReceipt(ledger,{id:chat,invitationId:invitation,stage:'acknowledged'});
 const entry=ledger.findInvitation(chat,invitation);assert.ok(entry.timestamps.acknowledged);assert.equal(entry.timestamps.opened,undefined);assert.equal(entry.timestamps.practiced,undefined);
 await recordPracticeReceipt(ledger,chat,{moment:{id:'m',invitationId:invitation},evidence:[]});assert.equal(ledger.findInvitation(chat,invitation).timestamps.practiced,undefined);
 await recordPracticeReceipt(ledger,chat,{moment:{id:'m',invitationId:invitation},evidence:[{momentId:'other',verdict:'correct'}]});assert.equal(ledger.findInvitation(chat,invitation).timestamps.practiced,undefined);
 await recordPracticeReceipt(ledger,chat,{moment:{id:'m',invitationId:invitation},evidence:[{momentId:'m',verdict:'incorrect'}]});assert.ok(ledger.findInvitation(chat,invitation).timestamps.practiced);
});
test('missing or failed ancillary receipt persistence cannot invalidate successful opening',async()=>{
 const diagnostics=[];
 for(const ledger of [{findInvitation:()=>null},{findInvitation:()=>({}),recordInvitation:async()=>{throw Error('Disk unavailable');}}]){
  assert.equal(await recordOpeningReceipt(ledger,chat,invitation,()=>diagnostics.push('unavailable')),false);
 }
 assert.equal(diagnostics.length,2);
});
