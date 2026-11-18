import {pathOf} from './work-selection.js';

export const TUTOR_POLICY = `Own the learner's skills: choose what helps their goals, why now and how to teach it. Never police coding or infer confusion from silence. Activity volume is not learning need. Missing context changes the route; never teach our lack of context or ability to observe. Teach a task mechanism or stay_silent.`;
export const EXPLANATION_REQUEST = `For my learning, briefly explain the approach you are taking on this task: the main components involved, how the current changes connect, and the reasoning behind the key decisions.

This is a request for understanding, not a review or a request to change the implementation. Respond at a natural checkpoint without interrupting the current work. Keep it to a short overview of the goal, components, current changes and key decisions; distinguish implemented behavior from planned work. If something is still undecided, label it as undecided.`;

// This is a workload signal, never an assessment of attention or competence.
// Metadata only; all inputs have already passed the observation sampler.
export function observeWorkload(session, source, now) {
  if (!['file.changed', 'tool.succeeded'].includes(source?.type)) return;
  const path = pathOf(source.data ?? {});
  if (!path) return;
  const time = Date.parse(now);
  const recent = (session.workload ?? []).filter(item => time - item.at < 180000 && item.path !== path);
  session.workload = [...recent, {path, at:time}].slice(-12);
}
export function workloadContext(session, now) {
  const recent=(session.workload??[]).filter(item=>Date.parse(now)-item.at<180000);
  return {recentChangedFiles:recent.map(item=>item.path),dense:recent.length>=4};
}
export function explanationRequest(goal) {
  const topic=String(goal?.outcome??'the current task').replace(/[\x00-\x1f]/g,' ').slice(0,80);
  return `Learning topic: ${topic}\n\n${EXPLANATION_REQUEST}`;
}

// Reject the observed failure class: commentary on our ability to notice learning
// is not a technical lesson about the learner's work. This is not a full relevance judge.
export function observationCommentary(value){
 const text=[value?.outcome,value?.title,value?.objective,value?.body,value?.insight].filter(Boolean).join(' ');
 return /\b(?:not(?: yet)? (?:a )?|no )teachable moment\b/i.test(text)||/\bvisible activity\b.{0,100}\b(?:learning|teachable)\b/i.test(text)||/\b(?:I|we|LearningHarness)\b.{0,40}\b(?:lack|missing|insufficient|not enough)\b.{0,20}\bcontext\b/i.test(text);
}
