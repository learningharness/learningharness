import test from 'node:test';import assert from 'node:assert/strict';import {register} from './entry-register.mjs';
test('footer runs actual Learn command once without a synthetic prompt or native lesson',async()=>{
 let render,end,calls=[],release;register((name,match,fn)=>{if(name==='ui.render')render=fn;if(name==='session.end')end=fn??match});
 const $={session:{surfaces:async()=>[]},clock:{every:()=>({cancel(){}})},ui:{resolve:()=>({Box:p=>({props:p}),Button:p=>({props:p})}),invalidate(){},toast(){}},command:{run:async p=>{calls.push(p);await new Promise(r=>release=r)}},prompt:{submit:()=>{throw Error('Must not submit prompt')} }};
 const tree=await render($,{surface:'desktop'},async()=>({host:true}));const button=tree.props.children[1];const first=button.props.onPress();await button.props.onPress();assert.deepEqual(calls,[{command:'learningharness:learn'}]);release();await first;await end($,{},async()=>({}));
});

test('background readiness updates the footer without a prompt, tool call or open',async()=>{
 const handlers={};let tick,label='on',invalidations=0,commandCalls=0;
 register((name,match,fn)=>{handlers[name]=fn??match;});
 const $={session:{id:async()=> 'chat',surfaces:async()=>[]},env:{get:async name=>name==='LEARNING_HARNESS_DATA_DIR'?'/state':'/home'},fs:{read:async path=>{if(path==='/plugin/entry-state.json')return JSON.stringify({directory:'/state'});if(path==='/state/state.json')return JSON.stringify({on:label!=='off'});assert.equal(path,'/state/chain-chat.json');return JSON.stringify({status:label==='ready'?'ready':'stale',preparedTarget:label==='ready'?{id:'saved'}:null});}},clock:{every:(ms,fn)=>{assert.equal(ms,5000);tick=fn;return{cancel(){}};}},ui:{resolve:()=>({Box:p=>({props:p}),Button:p=>({props:p})}),invalidate:()=>invalidations++,toast(){}},command:{run:()=>commandCalls++}};
 await handlers['session.start']($,{},async()=>({}));assert.equal(tick,undefined);await handlers['ui.render']($,{surface:'desktop'},async()=>({}));await new Promise(r=>setImmediate(r));
 label='ready';await tick();const tree=await handlers['ui.render']($,{surface:'desktop'},async()=>({}));assert.equal(tree.props.children[1].props.label,'◫ Learn · ready');assert.equal(commandCalls,0);assert(invalidations>0);
 label='off';await tick();const off=await handlers['ui.render']($,{surface:'desktop'},async()=>({}));assert.equal(off.props.children[1].props.label,'◫ Learn');await handlers['session.end']($,{},async()=>({}));
});

test('headless sessions start no footer timers or background processes',async()=>{
 const handlers={};register((name,match,fn)=>{handlers[name]=fn??match;});
 const $={session:{surfaces:async()=>[]},clock:{every:()=>assert.fail('headless timer')},process:{run:()=>assert.fail('headless process')}};
 await handlers['session.start']($,{},async()=>({}));
});
