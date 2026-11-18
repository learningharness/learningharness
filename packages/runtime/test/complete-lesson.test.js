import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExperience} from '../src/learning-engine.js';
import {publicLearningMoment} from '../../experiences/src/flashcard-deck.js';

const lesson = () => ({
  sections: [
    {title: 'Delivery and storage have different owners', body: 'An old GET can finish for its original caller after a write. That does not give it permission to refill the cache for later callers.'},
    {title: 'Trace one overlapping request', body: 'GET A starts at generation 1. A write advances the generation to 2. When A finishes, deliver its response to its caller, but store it only if the current generation is still 1.'},
  ],
  takeaway: 'Check generation equality before storing a response; decide caller delivery separately.',
});
const experience = (extra = {}) => ({
  decision: 'offer', kind: 'explain', title: 'A response can arrive without refilling the cache',
  objective: 'Distinguish caller delivery from cache publication',
  body: 'A completed response can serve its caller while being too old to enter the shared cache.',
  hook: 'Separate caller delivery from cache publication',
  ...extra,
});
const parse = value => parseExperience(JSON.stringify(value));

test('complete lesson survives parsing and public projection without truncation or a required quiz', () => {
  const content = lesson();
  content.sections[1].body += ' Later callers therefore cannot reuse the invalidated response. This is a cache publication rule; it does not alone cancel the original caller’s request.';
  assert.ok(content.sections[1].body.length > 280);
  const parsed = parse(experience({lesson: content}));
  assert.deepEqual(parsed.lesson, content);
  assert.equal(parsed.question, '');
  assert.deepEqual(publicLearningMoment(parsed).lesson, content);
});

test('complete lessons open with the full explanation even when prediction was suggested by the private design', () => {
  const content = lesson();
  const parsed = parse(experience({lesson: content,
    question: 'An older GET completes after invalidation. May its caller still receive it?',
    rubric: 'Separate delivery to the original caller from publication to later callers.',
    learningDesign: {version: 1, newAbility: 'Predict whether a stale response may be stored',
      distinction: {left: 'Deliver to the original caller', right: 'Publish to future callers'},
      addsBeyond: 'Trace the stale response across an intervening generation change.',
      capability: 'predict', approach: 'challenge_first', basis: {kind: 'unknown', evidenceIds: []}},
  }));
  assert.equal(parsed.entryMode, 'explanation');
  const visible = publicLearningMoment(parsed);
  assert.equal(visible.body, parsed.body);
  assert.deepEqual(visible.lesson, content);
  assert.equal(visible.rubric, undefined);
  assert.equal(visible.learningDesign, undefined);
});

test('complete lessons accept both section-count boundaries and all exact text limits', () => {
  for (const count of [2, 4]) {
    const content = {sections: Array.from({length: count}, () => ({title: 't'.repeat(80), body: 'b'.repeat(600)})), takeaway: 'k'.repeat(240)};
    assert.deepEqual(parse(experience({lesson: content})).lesson, content);
  }
});

const invalidLessons = [
  ['null payload', () => null],
  ['array payload', () => []],
  ['missing sections', () => ({takeaway: 'A useful distinction'})],
  ['missing takeaway', () => ({sections: lesson().sections})],
  ['unknown lesson field', () => ({...lesson(), html: '<script>run()</script>'})],
  ['sections object', () => ({...lesson(), sections: {}})],
  ['too few sections', () => ({...lesson(), sections: lesson().sections.slice(0, 1)})],
  ['too many sections', () => ({...lesson(), sections: Array.from({length: 5}, () => lesson().sections[0])})],
  ['null section', () => ({...lesson(), sections: [null, lesson().sections[1]]})],
  ['missing section title', () => ({...lesson(), sections: [{body: 'Concrete teaching'}, lesson().sections[1]]})],
  ['missing section body', () => ({...lesson(), sections: [{title: 'Concrete distinction'}, lesson().sections[1]]})],
  ['unknown section field', () => ({...lesson(), sections: [{...lesson().sections[0], url: 'https://example.com'}, lesson().sections[1]]})],
];
for (const [field, max] of [['title', 80], ['body', 600], ['takeaway', 240]]) {
  for (const [label, value] of [['empty', ''], ['blank', ' \n\t '], ['non-text', 42], ['too long', 'x'.repeat(max + 1)]]) {
    invalidLessons.push([`${label} ${field}`, () => {
      const content = lesson();
      if (field === 'takeaway') content.takeaway = value;
      else content.sections[0][field] = value;
      return content;
    }]);
  }
}
for (const [label, make] of invalidLessons) {
  test(`complete lesson rejects ${label} rather than silently discarding the payload`, () => {
    assert.throws(() => parse(experience({lesson: make()})));
  });
}

test('legacy saved explanations without lesson remain readable', () => {
  const parsed = parse(experience());
  assert.equal(parsed.lesson, undefined);
  assert.equal(parsed.body, experience().body);
  assert.equal(parsed.question, '');
});

test('legacy retrieval and adaptive practice questions remain readable without a complete lesson', () => {
  const parsed = parse(experience({kind: 'predict', question: 'May an invalidated response repopulate the cache?', rubric: 'No, if the generation no longer matches.'}));
  assert.equal(parsed.lesson, undefined);
  assert.equal(parsed.kind, 'predict');
  assert.equal(parsed.question, 'May an invalidated response repopulate the cache?');
});

import {createLearningTools} from '../src/learning-tools.js';
const privateDesign={version:1,newAbility:'Trace token ownership across clear',distinction:{left:'Promise delivery',right:'Map ownership'},addsBeyond:'Explain the actual guarded cleanup branch.',capability:'predict',approach:'worked_example',basis:{kind:'unknown',evidenceIds:[]}};
test('prepared lessons cite captured code at the section making the claim; invented or task-only citations fail',async()=>{
 const work=[{id:'task',type:'task.submitted',data:{text:'Implement cache clear'}},{id:'cache-file',type:'file.changed',data:{path:'cache.js',content:'if (inflight.get(key) === token) inflight.delete(key);'}}];
 const registry=createLearningTools({intent:'moment',preparing:true,work,learner:[],validateExperience:x=>parse(x)});
 const content=lesson();content.sections[0].sourceIds=['cache-file'];
 const call=(content,ids)=>registry.execute({tool:'present',reason:'Explain the captured cleanup branch',input:{sourceIds:ids,experience:experience({lesson:content,learningDesign:privateDesign})}},{check:()=>{}});
 await assert.rejects(call(lesson(),['task']),/captured code/);
 await assert.rejects(call(content,['task']),/validated source IDs/);
 await assert.rejects(call(content,['invented','cache-file']),/Unknown source/);
 await assert.rejects(call(content,['cache-file']),/exact captured code/);
 content.sections[0].code={sourceId:'cache-file',quote:work[1].data.content};
 const result=await call(content,['cache-file']);assert.deepEqual(result.value.experience.lesson.sections[0].sourceIds,['cache-file']);
 for(const sourceIds of [['cache-file','cache-file'],['x'.repeat(201)],['a','b','c','d'],[12],null])assert.throws(()=>parse(experience({lesson:{...lesson(),sections:[{...lesson().sections[0],sourceIds},lesson().sections[1]]}})));
});

test('every citation resolves to an excerpt, including files beyond the first three captured outputs',async()=>{
 const files=Array.from({length:4},(_,i)=>({id:'file'+i,type:'file.changed',data:{path:'file'+i+'.js',content:'export const value = '+i+';'}}));
 const work=[{id:'task',type:'task.submitted',data:{text:'Write modules'}},...files,{id:'empty',type:'tool.succeeded',data:{path:'empty.js',output:''}}];
 const registry=createLearningTools({intent:'moment',preparing:true,work,learner:[],validateExperience:x=>parse(x)});
 const content=lesson();content.sections[0].sourceIds=['file3'];content.sections[0].code={sourceId:'file3',quote:files[3].data.content};
 const call=(value,ids)=>registry.execute({tool:'present',reason:'Use a captured file',input:{sourceIds:ids,experience:experience({lesson:value,learningDesign:privateDesign})}},{check:()=>{}});
 assert.equal((await call(content,['file3'])).value.experience.lesson.sections[0].sourceIds[0],'file3');
 for(const id of ['task','empty']){const invalid=structuredClone(content);invalid.sections[1].sourceIds=[id];await assert.rejects(call(invalid,['file3',id]),/excerpt/);}
});

test('preparation identifies renderable citations separately from task intent and excludes secret paths', async () => {
  const {preparationPrompt} = await import('../src/preparation-prompt.js');
  const prompt = preparationPrompt({goal:{outcome:'Explain the captured branch'},trace:[
    {id:'intent',type:'task.submitted',data:{text:'Change the cache'}},
    {id:'summary',type:'assistant.ended',data:{text:'Implemented the guard'}},
    {id:'code',type:'file.changed',data:{path:'cache.js',content:'if (current === token) cache.set(key, value)'}},
    {id:'secret',type:'file.changed',data:{path:'.env',content:'PRIVATE=redacted-fixture'}},
  ]});
  const line=prompt.split('\n').find(line=>line.startsWith('DISPLAYABLE SECTION CITATION IDS:'));
  assert.equal(line,'DISPLAYABLE SECTION CITATION IDS:["code"]');
  const taskOnly=preparationPrompt({goal:{outcome:'Explain intended work'},trace:[{id:'intent',type:'task.submitted',data:{text:'Change the cache'}}]});
  assert.ok(taskOnly.includes('DISPLAYABLE SECTION CITATION IDS:[]'));
  assert.match(taskOnly,/empty.*omit section sourceIds/i);
});

test('published inline code is an exact cited capture, never a model rewrite or a different source',async()=>{
 const quote='  if (current === token) publish(value);';
 const work=[{id:'file',type:'file.changed',data:{path:'cache.js',content:'function done() {\n'+quote+'\n}'}},{id:'other',type:'file.changed',data:{path:'other.js',content:'unrelated'}},{id:'secret',type:'file.changed',data:{path:'.env',content:quote}}];
 const registry=createLearningTools({intent:'moment',preparing:true,work,learner:[],validateExperience:x=>parse(x)});
 const content=lesson();content.sections[0].sourceIds=['file'];content.sections[0].code={sourceId:'file',quote};
 const call=value=>registry.execute({tool:'present',reason:'Explain the exact guard',input:{sourceIds:['file','other','secret'],experience:experience({lesson:value,learningDesign:privateDesign})}},{check:()=>{}});
 const published=(await call(content)).value.experience;
 assert.deepEqual(publicLearningMoment(published).lesson.sections[0].code,{sourceId:'file',quote});
 const codeCitationOnly=structuredClone(content);delete codeCitationOnly.sections[0].sourceIds;
 const canonical=(await call(codeCitationOnly)).value.experience;
 assert.deepEqual(canonical.lesson.sections[0].sourceIds,['file'],'an explicit verified code source is itself a section citation');
 for(const code of [{sourceId:'file',quote:'if (current !== token) publish(value);'},{sourceId:'other',quote},{sourceId:'secret',quote}]){const invalid=structuredClone(content);invalid.sections[0].code=code;await assert.rejects(call(invalid),/exact captured|cited capture/);}
});


test('captured shell and C# sources also require an exact inline snippet, regardless of extension case',async()=>{
 for(const path of ['build.sh','Cache.cs','CACHE.CS','logic.lua','service.exs','app.dart']){
  const work=[{id:'source',type:'file.changed',data:{path,content:'captured exact source'}}];
  const registry=createLearningTools({intent:'moment',preparing:true,work,learner:[],validateExperience:x=>parse(x)});const content=lesson();content.sections[0].sourceIds=['source'];
  const call=()=>registry.execute({tool:'present',reason:'Explain captured source',input:{sourceIds:['source'],experience:experience({lesson:content,learningDesign:privateDesign})}},{check:()=>{}});
  await assert.rejects(call(),/exact captured code/);content.sections[0].code={sourceId:'source',quote:'captured exact source'};assert((await call()).value.experience.lesson.sections[0].code);
 }
});
