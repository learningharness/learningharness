import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkGraph,applyWorkGraphDelta,workGraphContext} from '../src/work-graph.js';

const topic=(ref,label,definition,conceptId='')=>({ref,conceptId,label,definition,sourceIds:['task']});
const delta={topics:[topic('expiry','Cache expiry','Entry eligibility ends at a time limit.'),topic('invalidate','Invalidation','A write makes an old cached value ineligible.')],relationships:[{subject:'expiry',predicate:'lh:usedTogetherIn',object:'invalidate',sourceIds:['task']}]};
const context={checkpointId:'host:chat:1',scope:'project_a',sessionID:'chat',createdAt:'2026-11-16T12:00:00Z',sources:[{id:'task',type:'task.submitted'}],candidates:[]};

test('a work encounter creates provisional concepts and connections, never assessment evidence',()=>{
 const graph=applyWorkGraphDelta(emptyWorkGraph(),delta,context);
 assert.equal(graph.concepts.length,2);assert.equal(graph.relationships.length,1);assert.equal(graph.encounters.length,2);
 assert.match(graph.concepts[0].id,/^urn:uuid:/);assert.equal(graph.concepts[0].status,'provisional');
 assert.equal(graph.relationships[0].status,'proposed');assert.equal(graph.encounters[0].sources[0].basis,'task_intent');
 assert.equal('evidence' in graph,false);assert.equal('mastery' in graph.concepts[0],false);
 assert.deepEqual(applyWorkGraphDelta(graph,delta,context),graph);
});
test('matching context permits explicit reuse, and identical labels cannot merge distinct definitions',()=>{
 let graph=applyWorkGraphDelta(emptyWorkGraph(),delta,context);
 const candidates=workGraphContext(graph,'cache expiry','project_a');assert.equal(candidates[0].label,'Cache expiry');
 graph=applyWorkGraphDelta(graph,{topics:[topic('e','Another label','Not a replacement definition',candidates[0].id)],relationships:[]},{...context,checkpointId:'next',candidates});
 assert.equal(graph.concepts.length,2);assert.equal(graph.concepts[0].label,'Cache expiry');assert.equal(graph.encounters.length,3);
 graph=applyWorkGraphDelta(graph,{topics:[topic('e','Cache expiry','Every successful read resets the deadline.')],relationships:[]},{...context,checkpointId:'sliding'});
 assert.equal(graph.concepts.length,3);assert.equal(workGraphContext(graph,'cache','project_b').length,0);
});
test('invented sources, unsupplied reuse IDs and learner claims reject an entire delta without mutation',()=>{
 const graph=emptyWorkGraph();
 for(const bad of [
  {...delta,topics:[{...delta.topics[0],sourceIds:['invented']}]},
  {...delta,topics:[{...delta.topics[0],conceptId:'urn:uuid:invented'}]},
  {...delta,topics:[{...delta.topics[0],mastery:1}]},
  {...delta,topics:Array.from({length:4},(_,i)=>topic('t'+i,'Topic','Definition'))},
 ])assert.throws(()=>applyWorkGraphDelta(graph,bad,context));
 assert.deepEqual(graph,emptyWorkGraph());
});
test('hierarchy cycles and ancestor-related conflicts are rejected atomically',()=>{
 for(const relationships of [
  [{subject:'expiry',predicate:'skos:broader',object:'invalidate',sourceIds:['task']},{subject:'invalidate',predicate:'skos:broader',object:'expiry',sourceIds:['task']}],
  [{subject:'expiry',predicate:'skos:broader',object:'invalidate',sourceIds:['task']},{subject:'expiry',predicate:'skos:related',object:'invalidate',sourceIds:['task']}],
 ])assert.throws(()=>applyWorkGraphDelta(emptyWorkGraph(),{...delta,relationships},context));
});
test('a broader topic and symmetric work connection remain separate proposed relations',()=>{
 const topics=[...delta.topics,topic('caching','Caching','Reusing a stored result instead of recomputing it.')];
 const graph=applyWorkGraphDelta(emptyWorkGraph(),{topics,relationships:[{subject:'expiry',predicate:'skos:broader',object:'caching',sourceIds:['task']},delta.relationships[0]]},context);
 assert.deepEqual(graph.relationships.map(e=>e.predicate),['skos:broader','lh:usedTogetherIn']);
 const candidates=graph.concepts.map(({id,label,definition})=>({id,label,definition}));
 const refs=graph.concepts.slice(0,2).map((c,i)=>topic('t'+i,c.label,c.definition,c.id));
 const next=applyWorkGraphDelta(graph,{topics:refs,relationships:[{subject:'t1',predicate:'lh:usedTogetherIn',object:'t0',sourceIds:['task']}]},{...context,checkpointId:'second-encounter',candidates});
 assert.equal(next.relationships.length,2);assert.equal(next.relationships[1].support.length,2);
});
