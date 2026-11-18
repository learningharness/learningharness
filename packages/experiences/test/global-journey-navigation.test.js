import test from 'node:test';
import assert from 'node:assert/strict';
import {globalJourneyRoute,resolveGlobalJourneyRoute} from '../src/global-journey-navigation.js';
const context=url=>({'openai/deepLink':{url}});
test('global deep links parse only bounded app-relative library, saved lesson and settings routes',()=>{
 assert.equal(globalJourneyRoute({displayMode:'fullscreen'}),null);
 assert.deepEqual(globalJourneyRoute(context('/')),{kind:'library'});
 assert.deepEqual(globalJourneyRoute(context('/settings')),{kind:'settings'});
 assert.deepEqual(globalJourneyRoute(context('/lessons/moment%3Aold_1')),{kind:'lesson',id:'moment:old_1'});
 for(const url of ['https://example.com/lessons/a','//example.com/','/lessons/../secret','/lessons/%2e%2e','/lessons/a%2fb','/lessons/a%5cb','/lessons/%252e%252e','/lessons/a#fragment','/lessons/a?x=y','/lessons/%00x','/lessons/%E0%A4%A','/lessons/'+ 'a'.repeat(201),'','/unknown'])assert.deepEqual(globalJourneyRoute(context(url)),{kind:'unavailable'},url);
});
test('saved deep links resolve only an existing public same-host record without changing its teaching',()=>{
 const record={id:'saved',host:'codex',title:'Actual saved teaching',body:'Frozen explanation',sources:[{text:'Captured code'}]};const state={capabilities:{host:'codex'},history:[record]};const before=structuredClone(state);
 const resolved=resolveGlobalJourneyRoute(state,{kind:'lesson',id:'saved'});assert.equal(resolved.kind,'lesson');assert.deepEqual(resolved.record,record);resolved.record.sources[0].text='Local reader copy';assert.deepEqual(state,before);
 assert.deepEqual(resolveGlobalJourneyRoute(state,{kind:'lesson',id:'missing'}),{kind:'unavailable'});
 assert.deepEqual(resolveGlobalJourneyRoute({...state,capabilities:{host:'claude'}},{kind:'lesson',id:'saved'}),{kind:'unavailable'});
 assert.deepEqual(resolveGlobalJourneyRoute(state,{kind:'library'}),{kind:'library'});
});
