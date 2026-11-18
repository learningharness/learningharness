import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompleteLesson,lessonCodeFocus} from '../src/complete-lesson.js';
const quote='  if (current === token) {\n    publish(value);\n  }';
const section={title:'Who may publish?',body:'Only the current owner may change shared state.',sourceIds:['file'],code:{sourceId:'file',quote}};
const lesson=()=>({sections:[structuredClone(section),{title:'A changed order',body:'An old caller may still receive its result.'}],takeaway:'Ownership and completion are separate.'});
test('inline focus preserves exact whitespace and resolves only against captured cited text',()=>{
 assert.deepEqual(validateCompleteLesson(lesson()).sections[0].code,{sourceId:'file',quote});
 const source={id:'file',path:'cache.js',text:'function done() {\n'+quote+'\n}',status:'Captured host output · excerpt',at:null};
 assert.deepEqual(lessonCodeFocus(section,[source]),{source,quote});
 assert.equal(lessonCodeFocus(section,[{...source,text:'a different revision'}]),null);
 assert.equal(lessonCodeFocus({...section,sourceIds:['other']},[source]),null);
 assert.equal(lessonCodeFocus(section,[]),null);
 assert.equal(lessonCodeFocus({title:'Legacy',body:'Saved teaching'},[source]),null);
});
test('code focus is bounded declarative text, not a replacement file or generated HTML',()=>{
 for(const code of [null,[],{}, {sourceId:'file',quote:''},{sourceId:'file',quote:'  '},{sourceId:'file',quote:'x'.repeat(601)},{sourceId:'file',quote:Array(13).fill('code').join('\n')},{sourceId:'file',quote,html:'<script/>'},{sourceId:'file',quote:42}]){
  const value=lesson();value.sections[0].code=code;assert.throws(()=>validateCompleteLesson(value));
 }
 const value=lesson();value.sections[0].code.quote='x'.repeat(600);assert.equal(validateCompleteLesson(value).sections[0].code.quote.length,600);
});
test('captured omission markers cannot masquerade as contiguous runnable code',()=>{
 const quote='old line\n[excerpt]\nnew line';
 assert.equal(lessonCodeFocus({...section,code:{sourceId:'file',quote}},[{id:'file',text:quote}]),null);
});
