import {sourceExcerpts} from './sources.js';
// A selected older topic must never borrow code from a different coding task.
export function selectLessonWork(frozen,current){
 const task=events=>events.find(event=>event.type==='task.submitted'&&typeof event.id==='string'&&event.id.trim());
 const original=task(frozen),latest=task(current);
 return structuredClone(original&&latest&&original.id===latest.id?current:frozen);
}

export function canSelectLessonWork(frozen,current){
 const task=events=>events.find(event=>event.type==='task.submitted'&&typeof event.id==='string'&&event.id.trim());
 return current.length===0||Boolean(task(current))||JSON.stringify(frozen)===JSON.stringify(current);
}

// A completed public summary cannot make unchanged captured code stale. Keep
// task identity and every file/tool outcome significant; task-only lessons
// still refresh when a summary is the first evidence of actual work.
export function sameLessonGrounding(frozen,current){
 const hasCode=sourceExcerpts(frozen,frozen.length).some(source=>source.path&&source.status==='Captured host output · excerpt');
 const material=events=>hasCode?events.filter(event=>event.type!=='assistant.ended'):events;
 return JSON.stringify(material(frozen))===JSON.stringify(material(current));
}
