import test from 'node:test';import assert from 'node:assert/strict';
import {createInvitationPublisher} from '../desktop-runtime/invitation-publisher.mjs';
import {projectRuntimeInvitation} from '../../packages/hosts/src/native-host.js';
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(){let release,reject,chain,calls=0,target;const session={goals:{list:[{outcome:'Trace a request',insight:'A real mechanism'}],snapshot:[{id:'source'}]}};const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:(_id,t)=>{calls++;target=t;return new Promise((res,rej)=>{release=res;reject=rej;});},record:()=>{}};const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>chain,writeChain:(_id,value)=>{chain=value;},projectRuntimeInvitation});return{engine,session,sync,get chain(){return chain;},get calls(){return calls;},get target(){return target;},release:()=>release(),reject:()=>reject(Error('builder failed'))};}
test('readiness waits for complete lesson, deduplicates progress events and freezes its topic',async()=>{const f=fixture();f.sync('chat');f.sync('chat');assert.equal(f.calls,1);assert.equal(f.chain,undefined);assert.equal(f.target.snapshot[0].id,'source');f.release();await settle();assert.equal(f.chain.status,'ready');assert.equal(f.chain.preparedTarget.id,f.target.id);f.session.goals.list[0].insight='New insight';assert.equal(f.chain.preparedTarget.goal.insight,'A real mechanism');});
test('failed preparation, a changed topic, and switching Off never publish an unready link',async()=>{for(const mode of ['fail','change','off']){const f=fixture();f.sync('chat');if(mode==='fail')f.reject();else{if(mode==='change')f.session.goals.list[0].outcome='Different topic';else f.engine.state.enabled=false;f.release();}await settle();assert.equal(f.chain,undefined);}});
test('failed preparation retries the same topic after backoff without a retry storm',async()=>{
 let clock=0,attempts=0;const session={goals:{list:[{outcome:'Retries',insight:'stable identity'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{attempts++;throw Error('temporary failure');},record:()=>{}};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>null,writeChain:()=>{},projectRuntimeInvitation,now:()=>clock,retryMs:100});
 sync('chat');await settle();sync('chat');await settle();assert.equal(attempts,1);
 clock=101;sync('chat');await settle();assert.equal(attempts,2);
});
test('a pause before publication does not permanently suppress the topic on resume',async()=>{
 const f=fixture();f.sync('chat');f.engine.state.enabled=false;f.release();await settle();
 f.engine.state.enabled=true;f.sync('chat');assert.equal(f.calls,2);f.release();await settle();assert.equal(f.chain.status,'ready');
});
test('a permanently failing topic stops automatic retries at the per-topic cap',async()=>{
 let clock=0,attempts=0;const session={goals:{list:[{outcome:'Retries',insight:'stable identity'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{attempts++;throw Error('invalid artifact');},record:()=>{}};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>null,writeChain:()=>{},projectRuntimeInvitation,now:()=>clock,retryMs:100});
 for(let n=0;n<6;n++){clock+=101;sync('chat');await settle();}assert.equal(attempts,3);
});

test('new foreground content is bound before advertising, even after an earlier card was opened',async()=>{
 const f=fixture();f.sync('chat');f.release();await settle();f.chain.cardAt=1;f.chain.signalAt=1;
 f.session.moment={id:'new-moment',title:'A four-stroke visual'};
 f.sync('chat');assert.equal(f.calls,2);assert.equal(f.target.kind,'moment');assert.equal(f.target.momentId,'new-moment');
 f.release();await settle();assert.equal(f.chain.runtimeKey,'moment:new-moment');assert.equal(f.chain.cardAt,undefined);
 f.sync('chat');assert.equal(f.calls,2);
});

test('code changes retract stale readiness and refresh after bounded backoff',async()=>{
 let clock=0,chain={status:'ready',runtime:true,runtimeKey:'null:Trace a request',taskId:null,preparedTarget:{id:'old',kind:'goal'}},calls=0,current=false;
 const session={goals:{list:[{outcome:'Trace a request',insight:'A real mechanism'}],snapshot:[{id:'source'}]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,preparedOpportunityCurrent:()=>current,prepareOpportunity:async()=>{calls++;current=true;return true;},record:()=>{}};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>chain,writeChain:(_id,value)=>{chain=value;},projectRuntimeInvitation,now:()=>clock,retryMs:100});
 sync('chat');await settle();assert.equal(chain.status,'stale');assert.equal(calls,0);
 clock=101;sync('chat');await settle();assert.equal(calls,1);assert.equal(chain.status,'ready');assert.notEqual(chain.preparedTarget.id,'old');
 sync('chat');await settle();assert.equal(calls,1);
});


test('fresh work retries without provider backoff while keeping the attempt cap',async()=>{
 let clock=0,attempts=0;const records=[];const session={goals:{list:[{outcome:'Ownership',insight:'Current code'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{attempts++;throw Object.assign(Error('work changed'),{code:'LEARNING_WORK_CHANGED'});},record:(...args)=>records.push(args)};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>null,writeChain:()=>{},projectRuntimeInvitation,now:()=>clock,retryMs:30000,workRetryMs:1000});
 sync('chat');await settle();clock=999;sync('chat');await settle();assert.equal(attempts,1);clock=1001;sync('chat');await settle();assert.equal(attempts,2);assert.equal(records[0][2].reason,'work-changed');
});

test('optional intent grace absorbs early implementation before spending on preparation',async()=>{
 let clock=0,calls=0;const session={trace:[],workSelection:{sequence:1},goals:{list:[{outcome:'Ownership',insight:'Current code'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{calls++;return true;},record:()=>{}};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>null,writeChain:()=>{},projectRuntimeInvitation,now:()=>clock,intentGraceMs:10000,settleMs:1000});
 sync('chat');clock=500;sync('chat');await settle();assert.equal(calls,0);
 clock=2000;session.trace=[{type:'file.changed'}];session.workSelection.sequence=2;sync('chat');clock=2500;sync('chat');await settle();assert.equal(calls,0);
 clock=3001;sync('chat');await settle();assert.equal(calls,1);
});
test('intent grace is bounded when implementation has not appeared',async()=>{
 let clock=0,calls=0;const session={trace:[],workSelection:{sequence:1},goals:{list:[{outcome:'Ownership',insight:'Task intent'}],snapshot:[]}};
 const engine={state:{enabled:true,sessions:{chat:session}},session:()=>session,prepareOpportunity:async()=>{calls++;return true;},record:()=>{}};
 const sync=createInvitationPublisher({getEngine:()=>engine,readChain:()=>null,writeChain:()=>{},projectRuntimeInvitation,now:()=>clock,intentGraceMs:10000,settleMs:1000});sync('chat');clock=10001;sync('chat');await settle();assert.equal(calls,1);
});
