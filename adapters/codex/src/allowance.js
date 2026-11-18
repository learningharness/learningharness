// Read-only account quota signals. Never retain identities, credit balances or
// reset-credit details, and never convert quota percentages into token counts.
export function createAllowanceReader({request,now=Date.now}){
 let nextRead=0,value=null,pending;
 return async function read(){
  if(pending)return pending;
  if(now()<nextRead)return value;
  nextRead=now()+300000;
  pending=(async()=>{try{
   const result=await request('account/rateLimits/read',{excludeResetCreditDetails:true},2500);
   const bucket=result?.rateLimitsByLimitId?.codex??(result?.rateLimits?.limitId==null||result.rateLimits.limitId==='codex'?result?.rateLimits:null);
   const observedAt=now(),windows=[];
   if(!bucket||bucket.rateLimitReachedType)return value=null;
   for(const slot of ['primary','secondary']){
    const w=bucket[slot];if(!w||!Number.isFinite(w.usedPercent)||w.usedPercent<0||w.usedPercent>100||!Number.isFinite(w.windowDurationMins)||w.windowDurationMins<=0||!Number.isSafeInteger(w.resetsAt)||w.resetsAt*1000<=observedAt)continue;
    windows.push({remainingPercent:Math.floor(100-w.usedPercent),windowMinutes:w.windowDurationMins,resetsAt:w.resetsAt*1000});
   }
   return value=windows.length?{observedAt,windows}:null;
  }catch{return value=null;}finally{pending=null;}})();
  return pending;
 };
}
