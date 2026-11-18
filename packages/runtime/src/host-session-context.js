// One durable opening per coding chat; retries never replay work or reset budgets.
export function createSessionContextLoader({host,engine,now=Date.now}) {
 const pending=new Map(),retryAfter=new Map();
 return async function ensureSession(id) {
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{
   if(!engine.state.sessions[id])await engine.openSession(id,await host.getSession(id));
   const session=engine.session(id);
   if(!engine.state.enabled||session.paused||session.context?.codingOpening||!host.getOpeningContext||now()<(retryAfter.get(id)??0))return;
   try {
    const codingOpening=await host.getOpeningContext(id);
    if(codingOpening&&engine.state.enabled&&!session.paused)await engine.openSession(id,{codingOpening});
    // An empty new chat must be retried after the first real message arrives.
   } catch {
    retryAfter.set(id,now()+30000);
    engine.record('coding_opening_unavailable',id,{status:'retrying'});
   }
  })();
  pending.set(id,job);
  try {await job;} finally {pending.delete(id);}
 };
}
