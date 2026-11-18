import test from 'node:test';
import assert from 'node:assert/strict';
import {usageAlertKey} from '../src/usage-alert.js';
const state=()=>({limits:{session:100,total:1000},usage:{input:100,output:30,calls:5},session:{id:'chat-a',usage:{input:90,output:20,calls:2}}});
test('dismissed usage alert stays quiet on polls and stays quiet for later learning calls',()=>{
 const s=state();const dismissed=usageAlertKey(s);assert(dismissed);
 assert.equal(usageAlertKey(structuredClone(s)),dismissed);
 s.session.phase='observing';assert.equal(usageAlertKey(s),dismissed);
 s.usage.calls++;s.session.usage.calls++;assert.equal(usageAlertKey(s),dismissed);
});
test('alerts distinguish chats and threshold changes and clear below thresholds',()=>{
 const s=state();const original=usageAlertKey(s);s.session.id='chat-b';assert.notEqual(usageAlertKey(s),original);
 s.session.id='chat-a';s.limits.session=120;assert.equal(usageAlertKey(s),null);
 s.usage.input=1000;assert(usageAlertKey(s));s.limits.total=2000;assert.equal(usageAlertKey(s),null);
 assert.equal(usageAlertKey(null),null);
});

test('persisted dismissal stays quiet after both thresholds and more calls',()=>{const s=state();s.session.usageAlertDismissed=true;s.usage.input=2000;s.usage.calls++;assert.equal(usageAlertKey(s),null);});
