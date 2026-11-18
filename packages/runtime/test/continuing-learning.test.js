import test from 'node:test';import assert from 'node:assert/strict';
import {LearningEngine} from '../src/learning-engine.js';
const lesson={sections:[{title:'Ownership',body:'Only the current token may change shared state.',sourceIds:['old-file']},{title:'Settlement',body:'An older promise still settles its own caller.'}],takeaway:'Settlement does not establish ownership.'};
const oldWork=[{id:'old-task',type:'task.submitted',data:{text:'Build a cache'}},{id:'old-file',type:'file.changed',data:{path:'cache.js',content:'OLD_CAPTURE: if (current === token) publish(value);'}}];
const saved=()=>({id:'lesson-old',sessionID:'old',kind:'explain',title:'Who owns the entry?',objective:'Token ownership',body:'Trace ownership.',lesson:structuredClone(lesson),question:'What may a stale completion change?',rubric:'Only its own caller.',sourceIds:['old-file'],snapshot:structuredClone(oldWork),completed:true,createdAt:'2026-01-01T00:00:00Z',feedback:{verdict:'correct',answer:'Its caller only.'}});
const prior={id:'attempt-old',momentId:'lesson-old',objective:'Token ownership',verdict:'correct',assisted:false,createdAt:'2026-01-01T00:00:00Z',project:'/old/cache',sessionTitle:'Build a cache'};
async function fixture(reply){let calls=0;const prompts=[];const e=new LearningEngine({storage:{get:async()=>null,set:async()=>{}},now:()=> '2026-01-03T00:00:00Z',debounceMs:60000,capabilities:{host:'codex',model:{independent:true},observation:{kinds:['task.submitted','file.changed']},surface:{}},defaultLearningModel:{providerID:'fixture',modelID:'fixture'},gateway:{generate:async input=>{calls++;prompts.push(input);return reply(input);}}});await e.load();await e.command({action:'enable'});e.state.history=[saved()];e.session('old').context={project:'/old/cache',title:'Build a cache'};e.session('old').evidence=[structuredClone(prior)];e.session('now').context={project:'/new/ui',title:'Build a UI'};return {e,prompts,calls:()=>calls};}
const design={version:1,newAbility:'Recall cache ownership',distinction:{left:'Caller outcome',right:'Cache authority'},addsBeyond:'A fresh recall question',capability:'explain',approach:'challenge_first',basis:{kind:'exposure',evidenceIds:[]}};
const card=ids=>({text:JSON.stringify({tool:'present_flashcard',reason:'Recall earlier learning',input:{learningDesign:design,title:'Revisit ownership',objective:'Token ownership',relevance:'From the earlier cache work',front:'What survives removal from the inflight map?',back:'The original promise can still settle for its caller.',sourceIds:ids}}),usage:{input:30,output:30}});
test('revisit opens an independent saved lesson without generation or changing the coding context',async()=>{
 const f=await fixture(()=>{throw Error('Revisit must be local');});const original=structuredClone(f.e.state.history[0]);
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'});const m=f.e.session('now').moment;
 assert.equal(f.calls(),0);assert.notEqual(m.id,original.id);assert.equal(m.revisitedOf,original.id);assert.equal(m.completed,false);assert.equal(m.learningContext.project,'/old/cache');assert.deepEqual(m.snapshot,oldWork);assert.equal(f.e.session('now').context.project,'/new/ui');assert.deepEqual(f.e.state.history[0],original);assert.equal(f.e.snapshot('now').session.moment.rubric,undefined);
 m.lesson.sections[0].body='changed';assert.deepEqual(f.e.state.history[0].lesson,lesson);
});
test('explicit due review can revisit an unrelated past coding session using only its captured sources',async()=>{
 const f=await fixture(()=>card(['old-file']));await f.e.onWorkEvent({id:'new-task',sessionId:'now',type:'task.submitted',data:{text:'Build a UI with NEW_CURRENT_WORK'}});for(const timer of f.e.parallelTimers.values())clearTimeout(timer);
 await f.e.command({action:'review-topic',sessionID:'now',value:'token ownership'});
 assert.equal(f.calls(),1);assert.match(f.prompts[0].prompt,/PREBUILD/);assert.match(f.prompts[0].prompt,/OLD_CAPTURE/);assert.doesNotMatch(f.prompts[0].prompt,/NEW_CURRENT_WORK/);assert.deepEqual(f.e.session('now').moment.snapshot,oldWork);assert.equal(f.e.session('now').moment.learningContext.project,'/old/cache');assert.equal(f.e.session('now').context.project,'/new/ui');
 const reviewID=f.e.session('now').moment.id;await f.e.command({action:'review-topic',sessionID:'now',value:'token ownership'});assert.equal(f.calls(),1);assert.equal(f.e.session('now').moment.id,reviewID);
});
test('missing original sources are explicit and never replaced by current work',async()=>{
 const f=await fixture(()=>card([]));f.e.state.history=[];await f.e.onWorkEvent({id:'new-task',sessionId:'now',type:'task.submitted',data:{text:'Build a UI with NEW_CURRENT_WORK'}});for(const timer of f.e.parallelTimers.values())clearTimeout(timer);
 await f.e.command({action:'review-topic',sessionID:'now',value:'token ownership'});
 assert.deepEqual(f.e.session('now').moment.snapshot,[]);assert.doesNotMatch(f.prompts[0].prompt,/NEW_CURRENT_WORK/);assert.match(f.prompts[0].prompt,/original.*unavailable/i);
});
test('revisited practice records the original project, not the active coding project',async()=>{
 const f=await fixture(()=>({text:JSON.stringify({tool:'assess_answer',reason:'Assess the learner reasoning',input:{verdict:'correct',feedback:'You separated settlement and ownership.',next:'Try a changed order.'}}),usage:{input:30,output:20}}));
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'});await f.e.command({action:'submit',sessionID:'now',value:{answer:'It settles its caller and leaves the replacement untouched.',confidence:'high'}});
 const evidence=f.e.session('now').evidence.at(-1);assert.equal(evidence.project,'/old/cache');assert.equal(evidence.sessionTitle,'Build a cache');assert.equal(evidence.assisted,true);assert.equal(evidence.learningEvent.kind,'immediate_practice');
});

test('reopening is blocked Off, unknown IDs preserve active work, and rereading adds no review evidence',async()=>{
 const f=await fixture(()=>{throw Error('No model call');});await f.e.command({action:'disable'});
 await assert.rejects(f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'}),/Turn learning on/);
 await f.e.command({action:'enable'});await assert.rejects(f.e.command({action:'revisit-lesson',sessionID:'now',value:'missing'}),/unavailable/);
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'});const active=f.e.session('now').moment.id;
 await assert.rejects(f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old',expectedMomentId:'stale'}),/changed/);
 assert.equal(f.e.session('now').moment.id,active);assert.equal(f.e.session('now').evidence.length,0);assert.equal(f.calls(),0);
});

test('practice after a revisit keeps historical sources even when current goals use the same objective',async()=>{
 const f=await fixture(()=>({text:JSON.stringify({tool:'present',reason:'Simplify the earlier learning',input:{sourceIds:[],experience:{decision:'offer',kind:'explain',title:'Follow one stale callback',objective:'Token ownership',body:'The caller settles while the newer load stays mapped.',question:'Why does an old rejection leave the new load intact?',rubric:'Only the matching token can delete it.',hook:'Trace the authority of one stale callback'}}}),usage:{input:30,output:20}}));
 f.e.session('now').goals={list:[{kind:'core',outcome:'Token ownership',whyNow:'New project',minutes:2}],snapshot:[{id:'new-task',type:'task.submitted',data:{text:'New project'}},{id:'new-file',type:'file.changed',data:{path:'ui.js',content:'NEW_CAPTURE'}}]};
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'});await f.e.command({action:'next-move',sessionID:'now',value:'easier'});
 assert.deepEqual(f.e.session('now').moment.snapshot,oldWork);assert.equal(f.e.session('now').moment.learningContext.project,'/old/cache');assert.doesNotMatch(f.prompts[0].prompt,/NEW_CAPTURE/);
});

test('native prepared review carries original sources and learning origin',async()=>{
 const f=await fixture(()=>{const reply=card(['old-file']),value=JSON.parse(reply.text);value.input.learningDesign={version:1,newAbility:'Recall the token cleanup condition',distinction:{left:'Settling a caller',right:'Owning a shared entry'},addsBeyond:'Recall the guard from earlier work.',capability:'explain',approach:'explanation',basis:{kind:'unknown',evidenceIds:[]}};reply.text=JSON.stringify(value);return reply;});
 await f.e.prepareOpportunity('now',{id:'prepared-review',kind:'review',reviewId:'due-review',review:{id:'due-review',key:'token ownership',objective:'Token ownership',whyNow:'A due review',momentId:'lesson-old',host:'codex'}});
 const prepared=f.e.session('now').preparedLessons['prepared-review'].moment;assert.deepEqual(prepared.snapshot,oldWork);assert.equal(prepared.learningContext.project,'/old/cache');assert.match(f.prompts[0].prompt,/OLD_CAPTURE/);
});
test('deck self-reports after revisiting retain the historical project',async()=>{
 const f=await fixture(()=>({text:JSON.stringify({tool:'present_flashcard_deck',reason:'Revisit earlier learning',input:{title:'Recall ownership',objective:'Token ownership',relevance:'Earlier cache work',cards:[{front:'Who owns the entry?',back:'The matching token.',objective:'Token ownership'},{front:'What still settles?',back:'The returned promise.',objective:'Token ownership'}],sourceIds:['old-file']}}),usage:{input:30,output:30}}));
 f.e.session('old').context.projectKey='project_11111111111111111111111111111111';f.e.session('now').context.projectKey='project_22222222222222222222222222222222';
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'lesson-old'});await f.e.command({action:'create-flashcard-deck',sessionID:'now'});const m=f.e.session('now').moment,cardId=m.deck.cards[0].id;await f.e.command({action:'deck-reveal',sessionID:'now',value:{cardId}});await f.e.command({action:'deck-rate',sessionID:'now',value:{cardId,rating:'remembered'}});
 const evidence=f.e.session('now').evidence.at(-1);assert.equal(evidence.projectKey,'project_11111111111111111111111111111111');assert.equal(evidence.project,'/old/cache');assert.equal(evidence.verdict,'self_reported');
});

test('review generation offers only retrieval tools, never a full-lesson teaching tool',async()=>{
 const {createLearningTools}=await import('../src/learning-tools.js');
 for(const preparing of [false,true]){const names=createLearningTools({intent:'moment',preparing,reviewOnly:true}).describe().map(tool=>tool.name);assert(names.includes('present_flashcard'));assert(names.includes('present'));assert(!names.includes('teach'));assert(!names.includes('build_interactive'));assert(!names.includes('present_flashcard_deck'));}
});

test('saved learning includes other active sessions and journey stages once, excluding current and unviewed preparation',async()=>{
 const f=await fixture(()=>{throw Error('History must be local');});
 const active={...saved(),id:'active-old',title:'An active saved lesson'};
 f.e.session('old').moment=active;f.e.session('old').feedback={verdict:'partial',answer:'My earlier reasoning'};
 f.e.session('now').moment={...saved(),id:'current'};
 f.e.session('old').preparedLessons={unopened:{moment:{...saved(),id:'unopened'}}};
 f.e.state.journeys={j:{id:'j',origin:{sessionID:'old',project:'/old/cache'},plan:{destination:'Understand ownership',steps:[]},stages:{0:{moment:active},1:{moment:{...saved(),id:'stage-only'},feedback:{verdict:'correct',answer:'Earlier stage answer'}}}}};
 const history=f.e.snapshot('now').history;
 assert.deepEqual(new Set(history.map(x=>x.id)),new Set(['lesson-old','active-old','stage-only']));
 assert.equal(history.find(x=>x.id==='active-old').feedback.answer,'My earlier reasoning');
 assert.equal(history.find(x=>x.id==='stage-only').learningContext.project,'/old/cache');
 assert(history.every(x=>x.canRevisit&&x.recordKind==='lesson'&&x.rubric===undefined));assert.equal(f.calls(),0);
});
test('legacy saved learning and other-session active teaching reopen locally with original provenance',async()=>{
 const f=await fixture(()=>{throw Error('Reopening must be local');});const legacy={...saved(),id:'legacy',body:'Saved causal explanation',comparison:{text:'Earlier worked example'}};delete legacy.lesson;
 f.e.state.history=[legacy];f.e.session('old').moment={...saved(),id:'active-old'};
 const before=structuredClone(legacy);
 assert.equal(f.e.snapshot('now').history.find(x=>x.id==='legacy').recordKind,'learning-note');
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'legacy'});
 let m=f.e.session('now').moment;assert.equal(m.lesson,undefined);assert.equal(m.body,legacy.body);assert.deepEqual(m.comparison,legacy.comparison);assert.deepEqual(m.snapshot,oldWork);assert.equal(m.learningContext.project,'/old/cache');assert.deepEqual(f.e.state.history.find(x=>x.id==='legacy'),before);
 await f.e.command({action:'revisit-lesson',sessionID:'now',value:'active-old'});m=f.e.session('now').moment;
 assert.equal(m.revisitedOf,'active-old');assert.equal(m.learningContext.project,'/old/cache');assert.equal(f.e.session('now').context.project,'/new/ui');assert.equal(f.calls(),0);
});
