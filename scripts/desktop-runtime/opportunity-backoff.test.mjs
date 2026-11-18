import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {opportunityBackoff} from './opportunity-backoff.mjs';
test('ignored opportunities wait2 then3 then4 user turns; tools and topic replacement do not reset',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lh-pacing-'));try{
 const step=(event={},chain={},deliver=false)=>opportunityBackoff(dir,'chat',event,chain,{deliver});
 assert(step({}, {},true));
 for(const gap of [2,3,4]){
  for(let n=1;n<gap;n++){assert.equal(step({hook_event_name:'UserPromptSubmit'}),false);assert.equal(step({hook_event_name:'PostToolUse'},{id:'new-topic'}),false);}
  assert(step({hook_event_name:'UserPromptSubmit'}));assert(step({}, {},true));
 }
 assert(step({}, {openedAt:100}));assert(step({}, {openedAt:100},true));
 assert.equal(step({hook_event_name:'UserPromptSubmit'},{openedAt:100}),false);assert(step({hook_event_name:'UserPromptSubmit'},{openedAt:100}));
 assert(opportunityBackoff(dir,'other',{}, {},{deliver:true}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
