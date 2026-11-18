// Local diagnostics are metadata only. Never accept arbitrary content/error text.
const events = new Set(['native_delivery_failed', 'native_operation_unavailable', 'native_preparation_failed', 'native_observation_unavailable', 'native_readiness_unavailable', 'opportunity_ready', 'bridge_connected', 'bridge_queued', 'bridge_claimed', 'bridge_finished', 'runtime_loaded', 'request_finished', 'control', 'observation_started', 'observation_stopped', 'observation', 'observer_failed', 'sample_selected', 'state_changed', 'cycle_started', 'cycle_completed', 'cycle_failed', 'response_recovered', 'tool_rejected', 'model_skipped', 'model_started', 'model_completed', 'model_failed', 'model_timeout']);
const enums = {
  model: ['default', 'haiku', 'sonnet', 'opus'],
  status: ['ready', 'unavailable', 'error', 'retrying', 'not-published'],
  format: ['interactive', 'mind-map', 'answer'],
  usage: ['measured', 'estimated'],
  intent: ['goals', 'moment', 'hint', 'ask', 'assessment', 'recap', 'other'],
  role: ['orchestrator', 'content-builder'],
  error: ['skill_id', 'bounds', 'decode', 'schema', 'timeout', 'cancelled', 'request_budget', 'provider', 'quota', 'auth', 'unsupported', 'unknown'],
  phase: ['observing', 'working', 'considering', 'goals', 'ready', 'feedback', 'assessing', 'recap', 'fault', 'no-model'],
  signal: ['task.submitted', 'reasoning.ended', 'assistant.ended', 'tool.started', 'tool.input.ended', 'tool.succeeded', 'tool.failed', 'file.changed', 'turn.started', 'turn.completed', 'model.selected'],
  action: ['enable', 'disable', 'stop', 'pause', 'resume', 'suggest', 'select-goal', 'refresh', 'request', 'ask', 'submit', 'hint', 'recap', 'dismiss', 'back-to-goals', 'open-upcoming-goals', 'set-learning-model']
};
const numbers = new Set(['durationMs', 'timeoutMs', 'inputBytes', 'inputTokens', 'outputTokens', 'attempt', 'remaining', 'selectedEvents', 'sampledBytes', 'observedEvents', 'observedBytes', 'pendingEvents', 'goalCount']);
export function diagnosticError(error) {
  const message = String(error?.message ?? error);
  if (/free usage limit|quota|rate limit|too many requests|429/i.test(message)) return 'quota';
  if (/unauthorized|forbidden|401|403|invalid.*(?:key|credential)/i.test(message)) return 'auth';
  if (/unsupported|model.*(?:unavailable|not found)|no model/i.test(message)) return 'unsupported';
  if (/timed out|deadline/i.test(message)) return 'timeout';
  if (/skill ID/i.test(message)) return 'skill_id';
  if (/bounds|length/i.test(message)) return 'bounds';
  if (/JSON|Unexpected EOF/i.test(message)) return 'decode';
  if (/stopped|paused|stale|superseded/i.test(message)) return 'cancelled';
  if (/budget exhausted/i.test(message)) return 'request_budget';
  if (/invalid|schema|expected|missing|Unknown key/i.test(message)) return 'schema';
  return 'provider';
}
export function diagnosticEntry(event, fields = {}) {
  if (!events.has(event)) return null;
  const entry = { event, at: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (enums[key]?.includes(value)) entry[key] = value;
    else if (numbers.has(key) && Number.isFinite(value) && value >= 0 && value <= 1e12) entry[key] = value;
    else if (['sessionID', 'cycleID', 'requestID'].includes(key) && typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,200}$/.test(value)) entry[key] = value;
  }
  return entry;
}
