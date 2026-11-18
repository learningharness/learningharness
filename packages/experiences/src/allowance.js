export function allowanceReminder(allowance,now=Date.now()){
 if(!allowance||!Number.isFinite(allowance.observedAt)||now<allowance.observedAt||now-allowance.observedAt>300000)return null;
 if(allowance.windows?.some(w=>w.resetsAt>now&&w.remainingPercent<10))return null;
 const windows=(allowance.windows??[]).filter(w=>w.remainingPercent>=10&&w.remainingPercent<=100&&w.resetsAt>now&&w.resetsAt-now<=86400000);
 // Prefer the weekly reset; short rolling windows are less useful reminders.
 const w=windows.sort((a,b)=>b.windowMinutes-a.windowMinutes)[0];
 if(!w)return null;
 return {...w,key:`${w.windowMinutes}:${w.resetsAt}`,label:w.windowMinutes===10080?'weekly':w.windowMinutes===300?'5-hour':`${w.windowMinutes}-minute`};
}
