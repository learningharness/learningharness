import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExperiment } from '../src/experiment.js';
import { visualFrame } from '../src/visual-artifact.js';
const spec=()=>({format:'visual',title:'Follow a message',viewBox:'0 0 640 260',scene:'<rect x="20" y="60" width="180" height="80" rx="12" fill="#242838"/><text x="40" y="105" fill="#eeeeff">Sender</text><rect x="400" y="60" width="180" height="80" rx="12" fill="#242838"/>',scenarios:[{label:'Success',steps:[{title:'Send',body:'The request crosses a boundary.',overlay:'<path d="M200 100 L400 100" stroke="#a29cf2"/><circle r="5" fill="#a29cf2"><animateMotion path="M200 100 L400 100" dur="1s" repeatCount="indefinite"/></circle>'},{title:'Reply',body:'A result comes back.',overlay:'<path d="M400 120 L200 120" stroke="#6fd6b0"/>'}]},{label:'Timeout',steps:[{title:'No reply',body:'The caller waits until its deadline.',overlay:'<text x="250" y="150" fill="#f1b66c">Timed out</text>'}]}]});
test('visual artifacts render different scenario frames with opaque scriptless sandbox policy',()=>{
 const value=validateExperiment(spec());const first=visualFrame(value,0,0,true);assert.match(first,/animateMotion/);assert.match(first,/script-src 'none'/);assert.doesNotMatch(visualFrame(value,0,0,false),/<animateMotion/);assert.match(visualFrame(value,1,0,false),/Timed out/);assert.throws(()=>visualFrame(value,9,0,true));
});
test('visual artifacts reject scripts, HTML escape, network resources and animation attribute mutation',()=>{
 for(const attack of ['<script>alert(1)</script>','</svg><img src="https://example.com">','<foreignObject><div>HTML</div></foreignObject>','<image href="https://example.com"/>','<rect onclick="alert(1)"/>','<rect fill="url(https://example.com)"/>','<set attributeName="href" to="https://example.com"/>','<rect><animate attributeName="href" values="x;y" dur="1s"/></rect>']){const value=spec();value.scene=attack;assert.throws(()=>validateExperiment(value),attack);}
});
test('visual artifact bounds and unsupported fields fail before rendering',()=>{
 const value=spec();value.scenarios[0].steps[0].overlay='<path d="M0 0" onload="bad()"/>';assert.throws(()=>validateExperiment(value));
 const other=spec();other.script='bad';assert.throws(()=>validateExperiment(other));
});

import { reuseArtifactReferences } from '../src/presentation.js';
test('status snapshots preserve artifact identity without hiding changed content',()=>{
 const prior={session:{moment:{experiment:spec()}}};
 const next=structuredClone(prior);
 assert.equal(reuseArtifactReferences(next,prior).session.moment.experiment,prior.session.moment.experiment);
 const changed=structuredClone(prior);changed.session.moment.experiment.title='Changed';
 assert.notEqual(reuseArtifactReferences(changed,prior).session.moment.experiment,prior.session.moment.experiment);
 assert.equal(prior.session.moment.experiment.title,'Follow a message');
 assert.match(visualFrame(spec()),/translate\(200 100\)/);
});
test('readable state metadata is bounded plain text and cannot carry extra markup fields',()=>{
 const v=spec();v.scenarios[0].steps[0].state=[{label:'Cache',value:'generation: 5'}];assert.equal(validateExperiment(v).scenarios[0].steps[0].state[0].value,'generation: 5');
 v.scenarios[0].steps[0].state[0].html='<script>bad()</script>';assert.throws(()=>validateExperiment(v),/unknown key/);
});
