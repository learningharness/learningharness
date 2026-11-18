import test from 'node:test';import assert from 'node:assert/strict';import {rm} from 'node:fs/promises';
import {startShortcutFixture} from './native-acceptance.mjs';import {runtimeCall} from './runtime-client.mjs';
test('native acceptance fixture uses only synthetic explicit chat and preserves Off/new-moment evidence',async()=>{
 const fixture=await startShortcutFixture(),options={env:{LEARNING_HARNESS_HOST:'claude',LEARNING_HARNESS_DATA_DIR:fixture.directory}};
 const call=(method,params)=>runtimeCall(method,params,options);
 try{
  assert.deepEqual(await call('desktop-action',{action:'off'}),{enabled:false});
  const list=await call('desktop-chats');assert.equal(list.chats.length,1);assert.equal(list.enabled,false);
  await assert.rejects(call('desktop-action',{action:'new-moment',id:'latest'}));
  const id=list.chats[0].id;await call('desktop-action',{action:'on',id});
  const {job}=await call('desktop-action',{action:'new-moment',id});
  assert.deepEqual(await call('desktop-job',{id,job}),{status:'ready'});
  assert.deepEqual(fixture.journal.map(x=>x.method),['desktop-action','desktop-chats','desktop-action','desktop-action','desktop-job']);
 }finally{await fixture.close();await rm(fixture.directory,{recursive:true,force:true});}
});
