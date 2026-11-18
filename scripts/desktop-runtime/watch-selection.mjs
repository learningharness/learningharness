// Validate freshness before admission; rotate eligible chats across bounded polls.
export function createWatchSelector({now=Date.now,limit=30}={}) {
 let cursor=0;
 return watches=>{
  const eligible=watches.filter(w=>w&&Number.isFinite(w.at)&&now()-w.at<=180000&&w.at<=now()+5000).sort((a,b)=>a.id.localeCompare(b.id));
  if(!eligible.length)return [];
  const start=cursor%eligible.length, selected=Array.from({length:Math.min(limit,eligible.length)},(_,i)=>eligible[(start+i)%eligible.length]);
  cursor=(start+selected.length)%eligible.length;return selected;
 };
}
