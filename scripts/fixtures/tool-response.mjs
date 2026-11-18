// Test/fixture migration only: old recorded content is emitted as explicit tool
// calls by the scripted provider. Production runtime has no v0 response bypass.
export function toolResponse(raw) {
  let value; try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return raw; }
  if (!value || value.tool || value.controls) return typeof raw === 'string' ? raw : JSON.stringify(raw);
  let tool; let input;
  if (value.goals) { tool = 'suggest_goals'; input = { goals: value.goals, ...(value.alreadySolid ? { alreadySolid: value.alreadySolid } : {}) }; }
  else if (value.decision === 'offer') { tool = 'present'; input = { experience: value, sourceIds: [] }; }
  else if (value.decision === 'silent') { tool = 'stay_silent'; input = { reason: value.reason }; }
  else if (value.verdict) { tool = 'assess_answer'; input = value; }
  else if (value.hint) { tool = 'provide_hint'; input = value; }
  else if (value.answer) { tool = 'answer_question'; input = value; }
  else if (value.recap) { tool = 'create_recap'; input = value; }
  else return raw;
  return JSON.stringify({ tool, input, reason: 'Scripted fixture for the current learning intent' });
}
