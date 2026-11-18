import test from 'node:test';
import assert from 'node:assert/strict';
import {sidebarQuickAction} from './sidebar-quick-action.mjs';
const icons=[{src:'data:image/svg+xml;base64,PHN2Zy8+',mimeType:'image/svg+xml',sizes:['any'],theme:'light'}];
test('sidebar qualification action targets the existing thread opening tool without a prompt or chat guess',()=>{
 const action=sidebarQuickAction(icons);
 assert.deepEqual(action,{title:'Learn beside this chat',icons,target:{type:'tool',name:'open_learn',arguments:{}}});
 assert.deepEqual(Object.keys(action.target),['type','name','arguments']);
 assert.deepEqual(Object.keys(action.target.arguments),[]);
});
test('navigation metadata copies icons and rejects context or callbacks as extra inputs',()=>{
 const action=sidebarQuickAction(icons);action.icons[0].sizes.push('32x32');assert.deepEqual(icons[0].sizes,['any']);
 for(const context of [{id:'latest'},{sessionID:'active'},{prompt:'Open Learn'},()=>assert.fail('Must not run callback')])assert.throws(()=>sidebarQuickAction(icons,context),/icons only/);
 for(const invalid of [undefined,null,[],{},[{src:''}],[{src:'file:///private/source'}]])assert.throws(()=>sidebarQuickAction(invalid),/icons/i);
});

test('global metadata gets only an auxiliary action without changing thread metadata or the presentation object',async()=>{
 const {sidebarEntryMetadata}=await import('./sidebar-quick-action.mjs');
 const original={'openai/ui':{entrypoints:[{type:'global'},{type:'thread'}]},custom:{untouched:true}};
 const presentation={entryMetadata:scope=>{assert.equal(scope,'global');return original;}};
 const metadata=sidebarEntryMetadata(presentation,icons);
 assert.deepEqual(metadata['openai/ui'].entrypoints,[{type:'global',quickAction:sidebarQuickAction(icons)},{type:'thread'}]);
 assert.equal(metadata.custom,original.custom);assert.equal(original['openai/ui'].entrypoints[0].quickAction,undefined);
 const noUI={custom:true};assert.equal(sidebarEntryMetadata({entryMetadata:()=>noUI},null),noUI);
});
