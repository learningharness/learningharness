import test from 'node:test';import assert from 'node:assert/strict';import {learningShortcut,runLearningControl} from '../src/learning-controls.js';
const key=(key,extra={})=>({key,metaKey:true,shiftKey:true,ctrlKey:false,altKey:false,...extra});
test('shortcuts are explicit setters; repeats, composition and unrelated chords do nothing',()=>{
 assert.equal(learningShortcut(key('L')),'on');assert.equal(learningShortcut(key('o')),'off');assert.equal(learningShortcut(key('m')),'new-moment');
 for(const e of [key('l',{repeat:true}),key('l',{isComposing:true}),key('l',{defaultPrevented:true}),key('l',{altKey:true}),key('o',{ctrlKey:true}),key('l',{metaKey:false})])assert.equal(learningShortcut(e),null);
 assert.equal(learningShortcut(key('l',{metaKey:false,ctrlKey:true}),false),'on');assert.equal(learningShortcut(key('o',{metaKey:false,ctrlKey:true}),false),'off');
 assert.equal(learningShortcut(key('m',{target:{tagName:'TEXTAREA'}})),null,'new content must not discard an unsent request');
});
test('On is idempotent and explicitly resumes a paused chat; Off never toggles back on',async()=>{
 const calls=[];let state={enabled:true,session:{paused:false}};const command=async action=>{calls.push(action);if(action==='disable')state={enabled:false,session:{paused:false}};if(action==='enable')state={...state,enabled:true};if(action==='resume')state={...state,session:{paused:false}};return state;};
 await runLearningControl('on',command);await runLearningControl('on',command);assert.equal(state.enabled,true);assert.deepEqual(calls,['enable','enable']);
 state={enabled:true,session:{paused:true}};await runLearningControl('on',command);assert.deepEqual(calls.slice(-2),['enable','resume']);
 await runLearningControl('off',command);await runLearningControl('off',command);assert.equal(state.enabled,false);assert.deepEqual(calls.slice(-2),['disable','disable']);
 await assert.rejects(runLearningControl('toggle',command),/Unknown/);
});

test('global Off takes precedence over a paused chat and the switch enables before resuming',async()=>{
 const {learningModeControl}=await import('../src/learning-controls.js');
 assert.deepEqual(learningModeControl({enabled:false,session:{paused:true}}),{label:'Off',checked:false,action:'on'});
 assert.deepEqual(learningModeControl({enabled:true,session:{paused:true}}),{label:'Paused',checked:false,action:'on'});
 assert.deepEqual(learningModeControl({enabled:true,session:{paused:false}}),{label:'On',checked:true,action:'off'});
 const calls=[];let state={enabled:false,session:{paused:true}};
 await runLearningControl(learningModeControl(state).action,async action=>{calls.push(action);if(action==='enable')state.enabled=true;if(action==='resume')state.session.paused=false;return state;});
 assert.deepEqual(calls,['enable','resume']);assert.equal(learningModeControl(state).label,'On');
});
