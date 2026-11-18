// Explicit event capture only. No browser SDK, autocapture, replay, or content.
export const ANALYTICS_VERSION = '1';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const oneOf = values => value => values.includes(value);
const number = value => Number.isFinite(value) && value >= 0 && value <= 1e12;
const boolean = value => typeof value === 'boolean';
const intent = oneOf(['goals', 'moment', 'hint', 'ask', 'assessment', 'recap', 'other']);
const role = oneOf(['orchestrator', 'content-builder']);
const kind = oneOf(['explain', 'predict', 'multiple_choice', 'explain_back', 'what_if', 'demonstrate', 'mind_map', 'recap', 'trace', 'diagnose', 'flashcard', 'flashcard_deck']);
const modelFamily = oneOf(['claude', 'gpt', 'gemini', 'deepseek', 'qwen', 'llama', 'other']);
const correlated = { session_id: uuid, moment_id: uuid };
const events = {
  runtime_started: {}, surface_opened: {},
  learning_enabled: {}, learning_disabled: {}, learning_stopped: {}, learning_paused: {}, learning_resumed: {},
  work_sampled: { selected_events: number, sampled_bytes: number, observed_events: number, observed_bytes: number },
  goals_offered: { count: number }, goals_silent: {},
  goal_selected: { goal_kind: oneOf(['orient', 'core', 'stretch']) }, moment_offered: { kind, interactive: boolean }, moment_silent: {}, moment_dismissed: { completed: boolean },
  help_used: { help_kind: oneOf(['hint', 'ask', 'source']) },
  attempt_completed: { verdict: oneOf(['correct', 'partial', 'incorrect']), assisted: boolean, evaluation_kind: oneOf(['practice']) },
  recap_completed: {},
  model_completed: { intent, role, model_family: modelFamily, duration_ms: number, input_tokens: number, output_tokens: number, usage_provenance: oneOf(['measured', 'estimated']) },
  model_failed: { role, model_family: modelFamily, duration_ms: number }, runtime_failed: {},
  command_failed: { action: oneOf(['new-moment', 'enable', 'disable', 'stop', 'pause', 'resume', 'suggest', 'select-goal', 'submit', 'hint', 'ask', 'request', 'recap', 'dismiss', 'next-move', 'refresh', 'back-to-goals', 'keep-going', 'save-draft', 'set-analytics', 'set-limits', 'set-sensitivity', 'set-content-builder-model', 'set-learning-model', 'reconcile', 'surface-opened']) }, setup_verified: {},
};

export function createAnalytics({ token, host = 'https://us.i.posthog.com', distinctId, adapter, surface,
  environment = 'pilot', fetch: send = globalThis.fetch, timeoutMs = 1500, maxQueue = 100, batchSize = 20, flushIntervalMs = 10000 } = {}) {
  const configured = typeof token === 'string' && /^phc_[a-zA-Z0-9_-]+$/.test(token) && uuid(distinctId)
    && ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)
    && ['opencode', 'claude', 'codex', 'fixture'].includes(adapter) && ['gui', 'tui', 'companion', 'native'].includes(surface)
    && ['development', 'pilot', 'production', 'test'].includes(environment) && typeof send === 'function';
  let enabled = false; let closed = false; let queue = []; let interval; let pending; let controller;
  const diagnostics = { delivered: 0, dropped: 0, failedBatches: 0 };
  const status = () => ({ configured: Boolean(configured), enabled, queued: queue.length, ...diagnostics });
  const setEnabled = value => {
    enabled = value === true && Boolean(configured) && !closed;
    if (!enabled) { queue = []; clearInterval(interval); interval = undefined; controller?.abort(); }
    else if (!interval) { interval = setInterval(() => { void flush(); }, flushIntervalMs); interval.unref?.(); }
  };
  function capture(name, properties = {}) {
    if (!enabled || !Object.hasOwn(events, name)) return;
    const allowed = { ...correlated, ...events[name] };
    const safe = Object.fromEntries(Object.entries(properties).filter(([key, value]) => Object.hasOwn(allowed, key) && allowed[key](value)));
    if (queue.length >= maxQueue) { queue.shift(); diagnostics.dropped++; }
    queue.push({ event: `dd_${name}`, distinct_id: distinctId, uuid: globalThis.crypto.randomUUID(), timestamp: new Date().toISOString(),
      properties: { ...safe, adapter, surface, environment, schema_version: ANALYTICS_VERSION, runtime_version: 'learning-harness-2', $geoip_disable: true, $process_person_profile: false } });
  }
  function flush() {
    if (pending) return pending;
    if (!enabled || !queue.length) return Promise.resolve();
    const batch = queue.splice(0, batchSize);
    controller = new AbortController(); const requestController = controller;
    let timeout;
    const aborted = new Promise(resolve => requestController.signal.addEventListener('abort', () => resolve(false), { once: true }));
    timeout = setTimeout(() => requestController.abort(), timeoutMs);
    const request = Promise.resolve().then(() => {
      if (!enabled || requestController.signal.aborted) return false;
      return send(`${host}/batch/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: token, batch }), signal: requestController.signal, redirect: 'error' });
    }).then(result => result?.ok === true).catch(() => false);
    pending = Promise.race([request, aborted]).then(ok => {
      if (ok) diagnostics.delivered += batch.length;
      else { diagnostics.failedBatches++; diagnostics.dropped += batch.length; }
    }).finally(() => { clearTimeout(timeout); controller = undefined; pending = undefined; });
    return pending;
  }
  return { capture, setEnabled, status, flush, close() { setEnabled(false); closed = true; } };
}
