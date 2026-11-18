import {validSessionId} from '../../packages/hosts/src/native-host.js';

// MCP publication is an attempt. A frame reading the saved invitation is an
// acknowledgement, not proof that a human saw it or learned from it.
export async function recordDeliveryReceipt(ledger,{id,invitationId,stage}){
 if(!validSessionId(id)||!validSessionId(invitationId))throw Error('Exact delivery identity required');
 if(!['attempted','acknowledged'].includes(stage))throw Error('Invalid delivery receipt stage');
 await ledger.recordInvitation(id,invitationId,stage);return {recorded:true};
}
export async function recordPracticeReceipt(ledger,id,session){
 const invitation=session?.moment?.invitationId;
 if(!invitation||!ledger.findInvitation(id,invitation))return;
 if(!session.evidence?.some(item=>item.momentId===session.moment.id&&['correct','partial','incorrect'].includes(item.verdict)))return;
 await ledger.recordInvitation(id,invitation,'practiced');
}
export async function recordOpeningReceipt(ledger,id,invitationId,onUnavailable=()=>{}){
 try{if(!ledger?.findInvitation(id,invitationId))throw Error('Delivery binding unavailable');await ledger.recordInvitation(id,invitationId,'opened');return true;}
 catch{onUnavailable();return false;}
}
