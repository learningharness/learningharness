import test from 'node:test';import assert from 'node:assert/strict';
import {settingsCapability,settingsTools,settingsCall} from './settings-entry.mjs';
test('native plugin settings advertises app-only read/update tools and full-app buttons',()=>{
 assert.deepEqual(settingsCapability,{readTool:'read_plugin_settings',updateTool:'update_plugin_settings'});
 for(const name of Object.values(settingsCapability)){
  const tool=settingsTools.find(tool=>tool.name===name);assert(tool);assert.deepEqual(tool._meta.ui.visibility,['app']);assert.equal(tool.annotations.readOnlyHint,true);assert(tool.outputSchema);
 }
 const read=settingsCall(settingsCapability.readTool,{});assert.deepEqual(read.content,[]);
 assert.deepEqual(read.structuredContent,{schema:{type:'object',properties:{}},values:{},layout:[{kind:'group',title:'LearningHarness',items:[{kind:'tool',tool:'open_learning_journey'},{kind:'tool',tool:'open_global_settings'}]}]});
 assert.deepEqual(settingsTools.find(tool=>tool.name===settingsCapability.readTool).outputSchema.required,['schema','values','layout']);
});
test('empty updates are explicit no-ops; unknown fields never become settings or callbacks',()=>{
 assert.deepEqual(settingsCall(settingsCapability.updateTool,{set:{}}),{content:[],structuredContent:{values:{}}});
 const forbidden=[undefined,{},null,[],{set:null},{set:[]},{set:{enabled:true}},{set:{billing:'paid'}},{set:{},scope:'global'},{set:{},callback:()=>assert.fail('Must not invoke callbacks')}];
 for(const args of forbidden)assert.throws(()=>settingsCall(settingsCapability.updateTool,args),/settings/i);
 for(const args of [null,[],{id:'latest'},{scope:'global'}])assert.throws(()=>settingsCall(settingsCapability.readTool,args),/settings/i);
 assert.throws(()=>settingsCall('open_global_settings',{}),/settings/i);
 assert.deepEqual(settingsCall(settingsCapability.readTool,{}).structuredContent.values,{});
});
test('read results are fresh and cannot mutate later native action layout',()=>{
 const result=settingsCall(settingsCapability.readTool,{});result.structuredContent.layout[0].items[0].tool='unexpected';result.structuredContent.values.enabled=true;
 const fresh=settingsCall(settingsCapability.readTool);assert.equal(fresh.structuredContent.layout[0].items[0].tool,'open_learning_journey');assert.deepEqual(fresh.structuredContent.values,{});
});
