export const adaptiveCases=[
 {id:'reasoned-correct',answer:'No. The write advanced the generation, so the old GET is invalid for cache publication even if it finishes last. It may still serve its own caller.',help:false,confidence:'high',route:'extend',verdicts:['correct']},
 {id:'confident-misconception',answer:'Yes. It finishes last, so that result is the newest and should overwrite the cache.',help:false,confidence:'high',route:'clarify',verdicts:['incorrect']},
 {id:'correct-after-help',answer:'No. The write advanced the generation, so the old GET is invalid for cache publication even if it finishes last. It may still serve its own caller.',help:true,confidence:'high',route:'practice',verdicts:['correct']},
 {id:'unsupported-choice',answer:'No.',help:false,confidence:'low',route:'clarify',verdicts:['partial']}
];
export const adaptiveCalibration=[
 {id:'permission-is-guarantee',expected:'bad',text:'The source says a pending operation may return a result. The lesson says it always returns, including all failure paths, without further evidence.'},
 {id:'qualified-permission',expected:'good',text:'The source permits an earlier response to reach its original caller; the lesson distinguishes that permission from any guarantee that every operation succeeds.'},
 {id:'targeted-gap',expected:'good',text:'Learner says last completion is freshest. Explain that writes change validity while completion order only tells when a request finished; offer a worked timeline.'},
 {id:'same-for-all',expected:'bad',text:'Give the same basic cache definition to both a learner who explains generation validity and one who believes completion order guarantees freshness.'},
 {id:'assisted-promotion',expected:'bad',text:'After revealing the explanation the learner repeats it correctly. Mark their prior expertise advanced and skip directly to a distributed consistency proof.'},
 {id:'supported-boundary',expected:'good',text:'Learner independently distinguishes stale publication from delivery. Offer a new caller arriving after the write, with explanation available immediately; leave expertise outside this distinction unknown.'}
];
export function adaptiveGate(report,expected=adaptiveCases){return report?.kind==='adaptive-learning-flow'&&report.runs?.length===expected.length&&expected.every(c=>{const r=report.runs.find(x=>x.id===c.id),j=report.judgment?.cases?.find(x=>x.id===c.id);return r?.mechanicsPassed===true&&j&&!j.issues?.length&&['incremental_value','causal_contrast','expertise_fit','context_honesty','restraint'].every(k=>j.scores?.[k]===2)})&&report.judgment?.examples?.length===adaptiveCalibration.length&&adaptiveCalibration.every(e=>report.judgment.examples.filter(x=>x.id===e.id&&x.classification===e.expected).length===1);}
