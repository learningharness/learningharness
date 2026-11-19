import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
for(const host of ['codex','claude'])test(`${host}: presentation defaults inline and persists independently of learning`,async()=>{
 let stored=null;let calls=0;
 const make=()=>new LearningEngine({storage:{get:async()=>stored,set:async(_,value)=>{stored=structuredClone(value);}},gateway:{generate:async()=>{calls++;throw Error('Unexpected inference');}},capabilities:{host,observation:{kinds:[]},model:{independent:true},surface:{}}});
 let e=make();await e.load();assert.equal(e.snapshot().settings.presentation,'inline');
 for(const value of ['sidebar','inline']){await e.command({action:'set-presentation',value});e=make();await e.load();assert.equal(e.snapshot().settings.presentation,value);assert.equal(e.snapshot().enabled,false);assert.deepEqual(e.state.sessions,{});}
 for(const value of [null,'fullscreen',true,{}])await assert.rejects(e.command({action:'set-presentation',value}),/Inline or Sidebar/);
 assert.equal(calls,0);
});
test('switching prepared cards preserves the first answer and feedback without inference',async()=>{
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{throw Error('Unexpected inference');}},capabilities:{host:'codex',observation:{kinds:[]},model:{independent:true},surface:{}}});await e.load();await e.command({action:'enable'});
 const session=e.session('chat'),first={id:'first',kind:'moment',momentId:'m1'},second={id:'second',kind:'moment',momentId:'m2'};
 session.preparedLessons={first:{moment:{id:'m1',invitationId:'first',kind:'predict',title:'First question',snapshot:[]}},second:{moment:{id:'m2',invitationId:'second',kind:'predict',title:'Second question',snapshot:[]}}};
 await e.openPreparedOpportunity('chat',first);await e.command({action:'save-draft',sessionID:'chat',value:{momentId:'m1',answer:'My reasoning',choice:'',confidence:'high'}});
 session.feedback={answer:'My reasoning',verdict:'partial',feedback:'Keep the boundary in mind'};
 await e.openPreparedOpportunity('chat',second);await e.openPreparedOpportunity('chat',first);
 assert.equal(session.draft?.answer,'My reasoning');assert.equal(session.feedback?.feedback,'Keep the boundary in mind');
 assert.equal(e.snapshot('chat').history.some(item=>item.id==='m2'&&item.sessionID==='chat'),true);
 await assert.rejects(e.command({action:'submit',sessionID:'chat',expectedMomentId:'m2',value:'Wrong card'}),/changed/);
});
test('a presentation cursor belongs to an existing invitation and the exact current step',async()=>{
 const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},gateway:{generate:async()=>{throw Error('Unexpected inference');}},capabilities:{host:'codex',observation:{kinds:[]},model:{},surface:{}}});await e.load();const s=e.session('chat');s.moment={id:'current'};s.preparedLessons={card:{moment:{id:'original'}}};
 await e.command({action:'set-presentation-cursor',sessionID:'chat',value:{invitationId:'card',momentId:'current'}});
 assert.deepEqual(s.presentationCursor,{invitationId:'card',momentId:'current'});
 for(const value of [{invitationId:'unknown',momentId:'current'},{invitationId:'__proto__',momentId:'current'},{invitationId:'constructor',momentId:'current'},{invitationId:'card',momentId:'old'},{invitationId:'card'}])await assert.rejects(e.command({action:'set-presentation-cursor',sessionID:'chat',value}),/changed/);
});
