import test from 'node:test';import assert from 'node:assert/strict';
import {quickQuestion} from '../src/inline-question.js';
test('only bounded predictions and quizzes are projected into inline questions',()=>{
 const quiz={id:'m',kind:'multiple_choice',title:'Failure cleanup',question:'What should happen after rejection?',choices:['Clear pending','Keep the promise'],body:'Concurrent callers share the same pending load.',lesson:{sections:[{body:'A full lesson'}]},rubric:'PRIVATE'};
 const view=quickQuestion(quiz);assert.equal(view.question,quiz.question);assert.equal(view.context,quiz.body);assert.equal(view.lesson,undefined);assert.equal(view.rubric,undefined);
 assert.equal(quickQuestion({...quiz,kind:'predict',choices:[]}).kind,'predict');
 for(const change of [{kind:'demonstrate'},{kind:'explain'},{kind:'mind_map'},{kind:'flashcard_deck'},{experiment:{}},{mindMap:{}},{question:''},{question:'x'.repeat(241)},{choices:Array(5).fill('Choice')},{choices:['x'.repeat(161),'B']},{body:'x'.repeat(281)}])assert.equal(quickQuestion({...quiz,...change}),null,JSON.stringify(change));
});
