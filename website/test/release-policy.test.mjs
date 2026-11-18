import {test} from 'node:test';import assert from 'node:assert/strict';
import {assertPublicationReady} from '../release-policy.mjs';
const pass={passed:true,evidence:'Recorded verification'};
test('public beta permits explicitly authorized distribution without claiming stable acceptance',()=>{
 const gate={approved:true,channel:'public-beta',betaChecks:{packages:pass},checks:{live_acceptance:{passed:false,evidence:''}}};
 assert.doesNotThrow(()=>assertPublicationReady(gate));
 assert.equal(gate.checks.live_acceptance.passed,false);
 assert.throws(()=>assertPublicationReady({...gate,channel:'stable'}),/live_acceptance/);
});
test('beta publication still rejects missing approval, evidence or checks',()=>{
 assert.throws(()=>assertPublicationReady({approved:false}),/approval/);
 for(const betaChecks of [undefined,{}, {packages:{passed:true,evidence:''}}, {packages:{passed:false,evidence:'pending'}}])assert.throws(()=>assertPublicationReady({approved:true,channel:'public-beta',betaChecks}));
});

test('additional candidate downloads need their own approval, checksum and verification evidence',()=>{
 const candidate={host:'claude',approved:true,channel:'release-candidate',file:'learning-harness-claude-1.0.0-beta.4.zip',sha256:'a'.repeat(64),checks:{archive:pass},nativeAcceptance:'pending'};
 const gate={approved:true,channel:'public-beta',betaChecks:{packages:pass},candidateArtifacts:[candidate]};
 assert.doesNotThrow(()=>assertPublicationReady(gate));
 for(const patch of [{approved:false},{sha256:'invalid'},{checks:{}},{checks:{archive:{passed:false,evidence:'pending'}}}])assert.throws(()=>assertPublicationReady({...gate,candidateArtifacts:[{...candidate,...patch}]}));
});
