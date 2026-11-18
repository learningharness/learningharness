import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnostics} from './diagnostics.mjs';
test('panel diagnostics retain only capability flags and bounded request counters',()=>{
 let saved;const d=createDiagnostics(x=>saved=x);
 d.observe('initialize',{capabilities:{extensions:{'io.modelcontextprotocol/ui':{}},secret:'private'}});
 d.observe('tools/call',{name:'open_learn',arguments:{secret:'private'},_meta:{'io.modelcontextprotocol/clientCapabilities':{extensions:{'io.modelcontextprotocol/ui':{}}}}});
 d.observe('resources/read',{uri:'ui://private/settings'});
 d.observe('tools/call',{name:'native_status',arguments:{secret:'private'}});
 assert.equal(saved.uiAdvertised,true);assert.equal(saved.launches,1);assert.equal(saved.htmlReads,1);assert.equal(saved.appRequests,1);
 assert(!JSON.stringify(saved).includes('private'));
});
test('diagnostic write errors cannot break host calls',()=>{
 const d=createDiagnostics(()=>{throw Error('disk unavailable')});assert.doesNotThrow(()=>d.observe('initialize',{}));
});
