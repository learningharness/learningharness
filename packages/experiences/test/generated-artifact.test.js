import test from 'node:test';import assert from 'node:assert/strict';
import {validateGeneratedArtifact} from '../src/generated-artifact.js';
import {validateMindMap} from '../src/mind-map.js';import {validateExperiment} from '../src/experiment.js';
const map={title:'Cache ownership',root:{label:'Writer',children:[{label:'Invalidates cache'}]}};
test('one content-builder spec envelope preserves the same validated artifact',()=>{
 assert.deepEqual(validateGeneratedArtifact(map,validateMindMap),validateMindMap(map));
 assert.deepEqual(validateGeneratedArtifact({spec:map},validateMindMap),validateMindMap(map));
 const flow={format:'flow',title:'Cache',participants:['Reader','Store'],steps:[{from:0,to:1,title:'Read',body:'Get value'},{from:1,to:0,title:'Return',body:'Return snapshot'}]};
 assert.deepEqual(validateGeneratedArtifact({spec:flow},validateExperiment),validateExperiment(flow));
});
test('normalizing a builder envelope never weakens the inner or outer allowlist',()=>{
 for(const value of [{spec:map,script:'evil'}, {spec:{...map,script:'evil'}},{spec:{spec:map}},{spec:null},{spec:[]},{spec:{...map,root:{label:'Wrong',url:'https://example.com'}}}])assert.throws(()=>validateGeneratedArtifact(value,validateMindMap));
 assert.throws(()=>validateGeneratedArtifact({spec:{format:'canvas',title:'Bad',height:400,html:'<iframe src="https://example.com"></iframe><canvas></canvas><script>void 0</script>'}},validateExperiment));
});
