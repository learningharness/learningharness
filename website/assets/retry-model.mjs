export function startScenario(protectedRequest=false){
 const key=protectedRequest?'order-42':null;
 return {payments:1,processedKeys:key?[key]:[],requests:[{idempotencyKey:key}],protectedRequest};
}
export function retryScenario(state){
 const key=state.requests[0].idempotencyKey;
 const reused=Boolean(key&&state.processedKeys.includes(key));
 return {...state,payments:state.payments+(reused?0:1),requests:[...state.requests,{idempotencyKey:key}],reused};
}
