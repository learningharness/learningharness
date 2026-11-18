import test from 'node:test';import assert from 'node:assert/strict';import {LearningEngine} from '../src/learning-engine.js';
import {observeWork,hasWorkUpdate,selectedWork} from '../../learning/src/work-selection.js';
const profile={goals:[],known:[],preferences:''};
function fixture(storage={get:async()=>null,set:async()=>{}}){return new LearningEngine({storage,gateway:{generate:async()=>{throw Error("Unexpected model call");}},capabilities:{host:'fixture',model:{},observation:{kinds:[]},surface:{}},learnerStore:{read:async()=>({profile,evidence:[],explorations:[]}),mergeEvidence:async()=>({profile,evidence:[],explorations:[]})}});}
test('a host resuming still-enabled learning retains prepared task context; Off still clears on enable',async()=>{
 const e=fixture();await e.load();await e.command({action:'enable'});const s=e.session('chat');observeWork(e.workSelection(s),{id:'task',type:'task.submitted',data:{text:'Build cache'}});s.goals={list:[{outcome:'Ownership'}]};const stored=structuredClone(e.state);
 for(const enabled of [true,false]){const data={...stored,enabled};const next=fixture({get:async()=>structuredClone(data),set:async()=>{}});await next.load({resumeEnabled:true});await next.command({action:'enable'});assert.equal(next.session('chat').workSelection.task?.id,enabled?'task':undefined);}
});
test('a complete preparation consumes work it already used, so unchanged code cannot trigger another automatic lesson',async()=>{
 const e=fixture();await e.load();await e.command({action:'enable'});const s=e.session('chat');const work=e.workSelection(s);observeWork(work,{id:'task',type:'task.submitted',data:{text:'Build cache'}});const snapshot=selectedWork(work);observeWork(work,{id:'code',type:'file.changed',data:{path:'cache.js',content:'export const cache = new Map();'}});assert(hasWorkUpdate(work));
 e.generateMoment=async(_id,{sourceSnapshot})=>({snapshot:sourceSnapshot,lesson:{sections:[{title:'Ownership',body:'Explain the captured branch.'}],takeaway:'Check ownership.'}});
 await e.prepareOpportunity('chat',{id:'prepared',kind:'goal',goal:{kind:'core',outcome:'Explain cache ownership',whyNow:'Async work overlaps.',minutes:3,insight:'An identity check fences stale work.'},snapshot});assert.equal(hasWorkUpdate(work),false);
 observeWork(work,{id:'next-code',type:'file.changed',data:{path:'cache.js',content:'export const cache = new WeakMap();'}});assert.equal(hasWorkUpdate(work),true);
});
