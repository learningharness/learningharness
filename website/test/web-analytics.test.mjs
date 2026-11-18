import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventProperties} from '../web-analytics.mjs';
test('only bounded acquisition fields leave the page',()=>{
 const p=eventProperties('https://learningharness.dev/?utm_source=twitter&utm_campaign=launch&email=private@example.com#secret','https://t.co/private?q=secret');
 assert.equal(p.source,'twitter');assert.equal(p.referrer,'t.co');assert.equal(p.path,'/');assert.ok(!JSON.stringify(p).includes('secret'));assert.ok(!JSON.stringify(p).includes('private'));
});
test('arbitrary campaign values and query strings are omitted',()=>{
 const p=eventProperties('https://learningharness.dev/docs/codex/?utm_source=private@example.com&utm_campaign=my-secret','');
 assert.equal(p.source,'other');assert.equal(p.campaign,'other');assert.equal(p.path,'/docs/codex/');
});
import {startAnalytics} from '../web-analytics.mjs';
test('privacy signals disable all collection and explicit events exclude arbitrary properties',async()=>{
 const saved={};for(const k of ['navigator','document','location','fetch'])saved[k]=Object.getOwnPropertyDescriptor(globalThis,k);
 const sent=[];let click;
 try{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{doNotTrack:'1'}});
 globalThis.document={referrer:'',addEventListener:(_,fn)=>click=fn};globalThis.location={href:'https://learningharness.dev/',hostname:'learningharness.dev',origin:'https://learningharness.dev'};
 globalThis.fetch=async(url,o)=>{sent.push(JSON.parse(o.body));};
 const config={token:'phc_test',host:'https://us.i.posthog.com'};
 startAnalytics(config);assert.equal(sent.length,0);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{globalPrivacyControl:true}});startAnalytics(config);assert.equal(sent.length,0);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});startAnalytics(config);assert.equal(sent[0].event,'lh_web_pageview');
 click({target:{closest:s=>s==='a'?{href:'https://learningharness.dev/downloads/learning-harness-claude-1.zip'}:null}});
 assert.equal(sent[1].event,'lh_web_download_click');assert.equal(sent[1].properties.host,'claude');assert.equal(sent[1].properties.$process_person_profile,false);assert.equal(sent[1].properties.$geoip_disable,true);
 }finally{for(const[k,v]of Object.entries(saved)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
});
