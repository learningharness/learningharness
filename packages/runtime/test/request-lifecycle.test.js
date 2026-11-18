import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/learning-engine.js';
const caps={host:'fixture',observation:{kinds:['task.submitted','file.changed']},model:{independent:true},surface:{experiments:true}};
async function make(generate=async()=>({text:'',usage:{input:1,output:1}})) {const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},capabilities:caps,debounceMs:60000,maxAutomaticChecksPerTask:1,maxGoalRequests:1});await e.load();await e.command({action:'enable'});return e;}
test('explicit request publishes pending state, then an unavailable reason instead of disappearing',async()=>{
 const e=await make(async()=>({text:JSON.stringify({tool:'stay_silent',input:{reason:'This format cannot represent that example.'},reason:'Unsupported example'}),usage:{input:1,output:1}}));
 let pending=false; e.emit=async()=>{if(e.session('w').requestStatus?.status==='pending')pending=true};
 await e.command({action:'request',sessionID:'w',value:'Make an interactive'});
 assert.equal(pending,true);assert.equal(e.session('w').requestStatus.status,'unavailable');assert.match(e.session('w').requestStatus.message,/cannot represent/);
});
test('failed request remains retryable without erasing an existing lesson',async()=>{
 const e=await make();const s=e.session('w');s.moment={id:'existing',completed:true};e.ask=async()=>{throw Error('Connection lost')};
 await assert.rejects(e.command({action:'request',sessionID:'w',value:'Show an interactive'}),/Connection lost/);
 assert.equal(s.moment.id,'existing');assert.equal(s.requestStatus.status,'error');assert.equal(s.requestStatus.text,'Show an interactive');
});
test('completed lesson requests append help rather than silently replacing the lesson',async()=>{
 const e=await make();const s=e.session('w');s.moment={id:'existing',completed:true};e.ask=async()=>{s.askAnswer={answer:'Built',experiment:{title:'Flow'}}};
 await e.command({action:'request',sessionID:'w',value:'Show an interactive'});
 assert.equal(s.moment.id,'existing');assert.equal(s.requestStatus.status,'ready');assert.equal(s.askAnswer.experiment.title,'Flow');
});
test('new task can offer a bounded proactive goal without replacing a current lesson or draft',async()=>{
 let calls=0;const e=await make(async()=>{calls++;return{text:JSON.stringify({tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Explain retry ownership',whyNow:'retry.ts now repeats requests',minutes:2}]},reason:'New work'}),usage:{input:1,output:1}}});
 const s=e.session('w');s.moment={id:'existing',completed:false,workRevision:0};s.draft={answer:'my unfinished thought'};
 try{await e.onWorkEvent({id:'new-task',sessionId:'w',type:'task.submitted',data:{text:'Build retry handling'}});await e.consider('w');
 assert.equal(calls,1);assert.equal(s.moment.id,'existing');assert.equal(s.draft.answer,'my unfinished thought');assert.equal(s.upcomingGoals.list[0].outcome,'Explain retry ownership');await e.consider('w');assert.equal(calls,1);
 }finally{for(const t of e.parallelTimers.values())clearTimeout(t)}
});

test('explicit interactive invokes the registered builder once and attaches while the existing lesson stays',async()=>{
 let n=0;const spec={title:'Flow stages',controls:[{id:'step',label:'Step',min:1,max:3,value:1}],outputs:[{label:'Messages delivered',expression:'step'}],experiments:['Change the step']};
 const e=await make(async input=>{n++;return{text:JSON.stringify(input.role==='content-builder'?spec:n===1?{tool:'build_interactive',input:{brief:'Show message flow stages'},reason:'The learner requested an interactive'}:{tool:'answer_question',input:{answer:'Move the step control to follow delivery.',artifactId:'artifact_1'},reason:'The example is validated'}),usage:{input:1,output:1}}});
 e.maxLearningRequests=3;const s=e.session('w');s.moment={id:'existing',completed:true,title:'Flow',kind:'explain',body:'Messages cross a boundary',snapshot:[],assistance:[]};
 await e.command({action:'request',sessionID:'w',value:'Make an interactive for message flow'});
 assert.equal(n,1);assert.equal(s.moment.id,'existing');assert.equal(s.requestStatus.status,'ready');assert.equal(s.askAnswer.experiment.title,'Flow stages');
});

test('a missing model is an explicit request result, not an empty success',async()=>{
 const e=await make();e.defaultLearningModel=null;
 await e.command({action:'request',sessionID:'w',value:'Explain this'});
 assert.equal(e.session('w').requestStatus.status,'unavailable');assert.match(e.session('w').requestStatus.message,/model/);
});

test('direct interactive builder validates the artifact and preserves the lesson on failure',async()=>{
 let calls=0;const e=await make(async()=>{calls++;return{text:JSON.stringify({format:'visual',title:'Bad',viewBox:'0 0 640 260',scene:'<script>bad()</script>',scenarios:[]})}});
 const s=e.session('w');s.moment={id:'existing',completed:true,title:'Flow',kind:'explain',snapshot:[],assistance:[]};
 await assert.rejects(e.command({action:'request',sessionID:'w',value:'Show an interactive'}));
 assert.equal(calls,1);assert.equal(s.moment.id,'existing');assert.equal(s.requestStatus.status,'error');assert.equal(s.askAnswer,null);
});
test('pausing during direct artifact generation discards its late result',async()=>{
 let finish,started;const begun=new Promise(resolve=>started=resolve);
 const spec={title:'Flow',controls:[{id:'step',label:'Step',min:1,max:3,value:1}],outputs:[{label:'Messages',expression:'step'}],experiments:['Change the step']};
 const e=await make(async()=>{started();return await new Promise(resolve=>finish=()=>resolve({text:JSON.stringify(spec)}))});
 const s=e.session('w');s.moment={id:'existing',completed:true,title:'Flow',kind:'explain',snapshot:[],assistance:[]};
 const pending=e.command({action:'request',sessionID:'w',value:'Show an interactive'});await begun;
 s.paused=true;finish();await pending.catch(()=>{});
 assert.equal(s.askAnswer,null);assert.equal(s.moment.id,'existing');
});

test('refreshing goals removes stale queued suggestions and orphaned request content',async()=>{
 const e=await make(async()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Fresh work',whyNow:'New evidence',minutes:2}]},reason:'Current work'})}));
 const s=e.session('w');s.upcomingGoals={id:'stale',list:[{outcome:'Old work'}]};s.askAnswer={question:'Old request',answer:'Old artifact'};s.requestStatus={text:'Old request',status:'ready'};
 await e.command({action:'suggest',sessionID:'w'});
 assert.equal(s.upcomingGoals,null);assert.equal(s.askAnswer,null);assert.equal(s.requestStatus,null);assert.equal(s.goals.list[0].outcome,'Fresh work');
});
test('refresh during an unfinished lesson gets new opportunities without discarding a draft',async()=>{
 const e=await make(async()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Fresh work',whyNow:'New evidence',minutes:2}]},reason:'Current work'})}));const s=e.session('w');s.moment={id:'kept',completed:false};s.draft={answer:'Keep my reasoning'};
 await e.command({action:'suggest',sessionID:'w'});assert.equal(s.moment.id,'kept');assert.equal(s.draft.answer,'Keep my reasoning');assert.equal(s.upcomingGoals.list[0].outcome,'Fresh work');
});
test('dismissing a standalone interactive keeps it in history and leaves the panel usable',async()=>{
 const e=await make();const s=e.session('w');s.askAnswer={question:'Show message flow',answer:'Explore it',experiment:{title:'Flow'},createdAt:'2026-11-02T00:00:00Z'};s.requestStatus={text:'Show message flow',status:'ready'};
 await e.command({action:'dismiss',sessionID:'w'});assert.equal(s.askAnswer,null);assert.equal(s.requestStatus,null);assert.equal(e.state.enabled,true);assert.equal(e.state.history[0].experiment.title,'Flow');
});

for(const decision of ['offer','silent'])test(`main-chat activity preserves standalone learning content when background decides ${decision}`,async()=>{
 const e=await make(async()=>({text:JSON.stringify(decision==='offer'?{tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'New work',whyNow:'A new coding task',minutes:2}]},reason:'Current work'}:{tool:'stay_silent',input:{reason:'Nothing useful to add'},reason:'Routine work'})}));
 const s=e.session('w');s.askAnswer={question:'Explain this',answer:'Existing explanation',experiment:{title:'My interactive'}};s.requestStatus={id:'request1',text:'Explain this',status:'ready'};s.draft={answer:'My thought'};
 try{await e.onWorkEvent({id:'new-task',sessionId:'w',type:'task.submitted',data:{text:'Build another feature'}});await e.consider('w');
 assert.equal(s.askAnswer.experiment.title,'My interactive');assert.equal(s.requestStatus.id,'request1');assert.equal(s.draft.answer,'My thought');if(decision==='offer')assert.equal(s.upcomingGoals.list[0].outcome,'New work');
 }finally{for(const t of e.parallelTimers.values())clearTimeout(t)}
});
test('an open panel keeps its existing offers when a new coding prompt arrives',async()=>{
 const e=await make(async()=>({text:JSON.stringify({tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Next idea',whyNow:'New work',minutes:2}]},reason:'New opportunity'})}));
 await e.command({action:'surface-opened',sessionID:'w'});const s=e.session('w');s.goals={id:'reading',list:[{outcome:'The idea I am reading'}]};
 try{await e.onWorkEvent({id:'another-task',sessionId:'w',type:'task.submitted',data:{text:'Add a cache'}});await e.consider('w');assert.equal(s.goals.id,'reading');assert.equal(s.upcomingGoals.list[0].outcome,'Next idea');}
 finally{for(const t of e.parallelTimers.values())clearTimeout(t)}
});
test('chat focus is scoped and persistent without changing general learner goals',async()=>{
 const e=await make();await e.command({action:'save-learner-profile',value:{goals:['Stay sharp'],known:[],preferences:''}});
 await e.command({action:'set-session-focus',sessionID:'w',value:'Understand cache invalidation'});
 assert.equal(e.session('w').learningFocus,'Understand cache invalidation');assert(!e.session('other').learningFocus);assert.deepEqual(e.state.learnerProfile.goals,['Stay sharp']);
 await e.command({action:'set-session-focus',sessionID:'w',value:''});assert.equal(e.session('w').learningFocus,'');
});

test('a retained goal keeps its original source snapshot after the coding task changes',async()=>{
 const e=await make(async input=>({text:JSON.stringify(input.intent==='moment'?{tool:'present',input:{experience:{decision:'offer',kind:'predict',title:'Cancel the wait too',objective:'Retry safety',relevance:'The retry helper changed',body:'A retry delay can outlive the caller unless cancellation also reaches the wait.',question:'What happens if only the request is cancelled?',rubric:'The delay can still schedule a later request.',hook:'Explore the cancellation boundary'},sourceIds:['old-file']},reason:'Teach the offered snapshot'}:{tool:'suggest_goals',input:{goals:[{kind:'core',outcome:'Retry safety',whyNow:'The retry helper changed',minutes:2,insight:'Cancellation needs to reach both the request and the wait.'}]},reason:'Work grounded'})}));
 try{await e.onWorkEvent({id:'old-file',sessionId:'w',type:'file.changed',data:{path:'retry.ts',diff:'+ abort the wait'}});await e.command({action:'suggest',sessionID:'w'});await e.command({action:'surface-opened',sessionID:'w'});
 await e.onWorkEvent({id:'task-new',sessionId:'w',type:'task.submitted',data:{text:'Build a search cache'}});await e.onWorkEvent({id:'new-file',sessionId:'w',type:'file.changed',data:{path:'cache.ts',diff:'+ invalidate entries'}});
 await e.command({action:'select-goal',sessionID:'w',value:0});const ids=e.session('w').moment.snapshot.map(x=>x.id);assert(ids.includes('old-file'));assert(!ids.includes('new-file'));
 }finally{for(const t of e.parallelTimers.values())clearTimeout(t)}
});
