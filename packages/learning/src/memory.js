import {capabilityMetadata} from './learning-design.js';
import {calibration} from './confidence.js';
// A projection of recorded observations. It never diagnoses a misconception
// or certifies mastery from exposure, assisted success, or interaction count.
export function deriveMemory(evidence) {
  const topics = Object.create(null); const sequence = [];
  for (const item of evidence) {
    const key = item.skillId || item.objective;
    if (!key) continue;
    const topic = topics[key] ??= { skillId: item.skillId ?? null, objective: item.objective, attempts: 0, assistedCorrect: 0, unassistedCorrect: 0, independentCorrect: 0, independentMomentIds: [], lastVerdict: null, lastAt: null, status: 'exploring', uncertainty: 'Retention and transfer have not been established.' };
    topic.selfReportedRemembered??=0;topic.selfReportedMissed??=0;topic.confidentErrors??=0;topic.uncertainCorrect??=0;
    if(item.verdict==='self_reported'){if(item.selfRating==='remembered')topic.selfReportedRemembered++;else topic.selfReportedMissed++;}
    if(item.confidence==='high'&&item.verdict==='incorrect')topic.confidentErrors++;if(item.confidence==='low'&&item.verdict==='correct')topic.uncertainCorrect++;
    topic.attempts++; topic.lastVerdict = item.verdict; topic.lastAt = item.createdAt;
    if (item.verdict === 'correct') {
      if (item.assisted || item.assistance?.length) topic.assistedCorrect++;
      else topic.unassistedCorrect++;
      // Legacy labels and different moment IDs are not an independent protocol.
      if (item.conditions?.mode === 'independent_check' && item.conditions.freshTaskVerified === true && item.conditions.sourceExposed === false && !item.assisted && !item.assistance?.length && item.taskFingerprint && !topic.independentMomentIds.includes(item.taskFingerprint)) {
        topic.independentMomentIds.push(item.taskFingerprint); topic.independentCorrect++;
      }
    }
    topic.status = topic.independentCorrect ? 'first_independent_evidence' : topic.unassistedCorrect ? 'unassisted_practice' : topic.assistedCorrect ? 'practiced_with_assistance' : 'exploring';
    const ts = Date.parse(item.createdAt);
    if (Number.isFinite(ts)) topic.nextReview = new Date(ts + 86400000).toISOString();
  }
  return { topics, sequence };
}
export function relevantMemory(memory, skillId, evidence) {
  const topics = Object.values(memory.topics ?? {}).filter(t => !skillId || t.skillId === skillId).slice(-8);
  return { topics, recent: evidence.filter(e => !skillId || e.skillId === skillId).slice(-3).map(evidenceSummary), uncertainty: 'Skill identifiers are proposed mappings. Practice success alone does not establish independent capability.' };
}
export function evidenceSummary(item) {
  return { ...capabilityMetadata(item),id: item.id ?? item.momentId, ...(typeof item.projectKey==='string'&&/^project_[a-f0-9]{32}$/.test(item.projectKey)?{projectKey:item.projectKey}:{}),momentId: typeof item.momentId === 'string' ? item.momentId.slice(0,240) : undefined, project: typeof item.project === 'string' ? item.project.slice(0,120) : undefined, sessionTitle: typeof item.sessionTitle === 'string' ? item.sessionTitle.slice(0,160) : undefined, skillId: item.skillId ?? null, objective: item.objective,
    question: String(item.question ?? '').slice(0, 200), answer: String(item.answer ?? '').slice(0, 600),
    verdict: item.verdict, ...(item.selfRating?{selfRating:item.selfRating}:{}), ...(item.confidence?{confidence:item.confidence}:{}), ...(item.confidence?{calibration:calibration(item.verdict,item.confidence)}:{}), feedback: String(item.feedback ?? '').slice(0, 400),
    assisted: item.assisted === true, assistance: (item.assistance ?? []).map(e => ({ kind: e.kind, at: e.at })).slice(-8),
    conditions: item.conditions ?? { mode: 'legacy_unknown' }, createdAt: item.createdAt };
}
