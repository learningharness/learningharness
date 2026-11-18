import {createServer} from 'node:http';
import {connect} from 'node:net';
import {chmod,lstat,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// Credentials stay inside Claude. Each native coding session leases only its
// own jobs through this private socket. Polling continues during generation.
const FRESH_MS=8000,MAX_BODY=2000000,MAX_PENDING=8,MAX_WORKERS=64;
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=200;
const unavailable=()=>Object.assign(new Error('Open LearningHarness in this Claude Code chat to connect learning.'),{code:'BRIDGE_UNAVAILABLE'});
export function createSubscriptionBridge({socketPath,now=Date.now,diagnostics=null}) {
 const jobs=new Map(),workers=new Map();let owned=false;
 const fresh=w=>Boolean(w&&now()-w.at<FRESH_MS);
 const connected=sessionId=>sessionId?fresh(workers.get(sessionId))&&workers.get(sessionId).auth==='bearer':[...workers.values()].some(w=>fresh(w)&&w.auth==='bearer');
 const record=(event,job,fields={})=>diagnostics?.record({event,sessionID:job.sessionId,requestID:job.id,...fields});
 const settle=(id,error,value)=>{const job=jobs.get(id);if(!job)return;jobs.delete(id);clearTimeout(job.timer);record('bridge_finished',job,{durationMs:Math.max(0,now()-job.started),status:error?'error':'ready',...(error?{error:/timed out/.test(error.message)?'timeout':/cancelled/.test(error.message)?'cancelled':'provider'}:{})});error?job.reject(error):job.resolve(value);};
 const cancel=sessionId=>{for(const [id,job] of jobs)if(!sessionId||job.sessionId===sessionId)settle(id,new Error('Learning request cancelled'));};
 const readBody=req=>new Promise((resolve,reject)=>{let size=0;const parts=[];req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(new Error('too large'));req.destroy();}else parts.push(c);});req.on('end',()=>resolve(Buffer.concat(parts).toString('utf8')));req.on('error',reject);});
 const reply=(res,status,body)=>{res.writeHead(status,body?{'Content-Type':'application/json'}:{});res.end(body?JSON.stringify(body):undefined);};
 const server=createServer(async(req,res)=>{
  try{
   if(req.method!=='POST')return reply(res,404);
   const body=JSON.parse(await readBody(req));
   if(body.version!==2||!identity(body.sessionId)||!identity(body.workerId))return reply(res,400);
   if(req.url==='/v2/poll'){
    const previous=workers.get(body.sessionId);
    if(fresh(previous)&&previous.workerId!==body.workerId)return reply(res,409);
    for(const [id,w] of workers)if(!fresh(w))workers.delete(id);
    if(!workers.has(body.sessionId)&&workers.size>=MAX_WORKERS)return reply(res,429);
    const auth=body.auth==='bearer'?'bearer':'none';
    if(auth==='bearer'&&(!fresh(previous)||previous.auth!=='bearer'))diagnostics?.record({event:'bridge_connected',sessionID:body.sessionId,status:'ready'});
    workers.set(body.sessionId,{workerId:body.workerId,auth,at:now(),model:typeof body.model==='string'?body.model.slice(0,200):null,cwd:typeof body.cwd==='string'?body.cwd.slice(0,4000):null});
    if(previous&&previous.workerId!==body.workerId)cancel(body.sessionId);
    if(auth!=='bearer'){cancel(body.sessionId);return reply(res,200,body.activeJobId?{cancel:body.activeJobId}:{});}
    if(body.activeJobId){
     const job=jobs.get(body.activeJobId);
     return reply(res,200,job?.sessionId===body.sessionId&&job.workerId===body.workerId?{}:{cancel:body.activeJobId});
    }
    const job=[...jobs.values()].find(j=>j.sessionId===body.sessionId&&!j.workerId);
    if(!job)return reply(res,200,{});
    job.workerId=body.workerId;record('bridge_claimed',job,{durationMs:Math.max(0,now()-job.started)});return reply(res,200,{job:{id:job.id,sessionId:job.sessionId,...job.request}});
   }
   if(req.url==='/v2/result'){
    const job=jobs.get(body.id);
    if(!job||job.sessionId!==body.sessionId||job.workerId!==body.workerId||!connected(body.sessionId)||workers.get(body.sessionId)?.workerId!==body.workerId)return reply(res,404);
    if(body.isAnswered===true&&typeof body.text==='string')settle(body.id,null,{text:body.text,usage:body.usage??null});
    else settle(body.id,Object.assign(new Error('Claude could not complete this learning step. Try again.'),{reason:String(body.reason??'unknown').slice(0,40)}));
    return reply(res,204);
   }
   reply(res,404);
  }catch{reply(res,400);}
 });
 const listening=(async()=>{
  try{
   const entry=await lstat(socketPath);
   if(!entry.isSocket())throw new Error('Bridge path is not a socket');
   await new Promise((resolve,reject)=>{const socket=connect(socketPath);socket.once('connect',()=>{socket.destroy();reject(new Error('LearningHarness bridge is already running'));});socket.once('error',error=>error.code==='ECONNREFUSED'?resolve():reject(error));});
   await unlink(socketPath);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve);});owned=true;
  await chmod(socketPath,0o600);
 })();
 return {listening,connected,status:()=>({connected:connected(),sessions:[...workers].filter(([,w])=>fresh(w)&&w.auth==='bearer').map(([id,w])=>({id,cwd:w.cwd,model:w.model,at:w.at}))}),
  request({model=null,system='',prompt,maxTokens=16000,effort='low',timeout=45000,parentSessionId}) {
   if(!identity(parentSessionId)||!connected(parentSessionId))return Promise.reject(unavailable());
   if(jobs.size>=MAX_PENDING)return Promise.reject(new Error('Learning is busy. Try again shortly.'));
   const id=randomUUID();return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>settle(id,new Error('Claude learning request timed out. Coding continues.')),timeout);
    record('bridge_queued',{id,sessionId:parentSessionId},{timeoutMs:timeout,model:model??'default'});
    jobs.set(id,{id,started:now(),sessionId:parentSessionId,request:{model,system,prompt,maxTokens,effort,timeoutMs:timeout},workerId:null,timer,resolve,reject});
   });
  },cancel,
  async close(){cancel();if(!owned)return;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});owned=false;await unlink(socketPath).catch(()=>{});},
 };
}
