import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/posthog.js';

const id = '9bc5a795-3603-4443-8bea-57bdb257dca9';
const config = { token: 'phc_test', host: 'https://us.i.posthog.com', distinctId: id, adapter: 'opencode', surface: 'gui' };
test('every event rejects identity, content and reserved PostHog enrichment fields before transport', async () => {
  const names = ['runtime_started', 'surface_opened', 'learning_enabled', 'learning_disabled', 'learning_stopped', 'learning_paused', 'learning_resumed', 'work_sampled', 'goals_offered', 'goals_silent', 'goal_selected', 'moment_offered', 'moment_silent', 'moment_dismissed', 'help_used', 'attempt_completed', 'recap_completed', 'model_completed', 'model_failed', 'runtime_failed', 'command_failed', 'setup_verified'];
  const canary = 'PRIVACY_CANARY_person@example.invalid_/Users/person/private_repo_function_secret()';
  const injected = Object.fromEntries(['email', 'name', 'ip', '$ip', '$set', '$set_once', '$user_id', '$device_id', '$current_url', '$referrer', '$geoip_city_name', 'distinct_id', 'code', 'prompt', 'answer', 'path', 'error', 'headers', 'session_id', 'moment_id', 'kind', 'action', 'model_family', 'intent', 'role'].map(key => [key, canary]));
  const requests = [];
  const analytics = createAnalytics({ ...config, adapter: 'codex', surface: 'native', batchSize: 100,
    fetch: async (url, request) => { requests.push({ url, request }); return { ok: true }; } });
  try {
    analytics.setEnabled(true);
    for (const name of names) analytics.capture(name, { ...injected, nested: { email: canary } });
    analytics.capture(canary, injected);
    await analytics.flush();
    assert.equal(requests.length, 1);
    const { url, request } = requests[0];
    assert.equal(url, 'https://us.i.posthog.com/batch/');
    assert.equal(request.redirect, 'error');
    assert.deepEqual(request.headers, { 'Content-Type': 'application/json' });
    assert.equal(request.body.includes(canary), false);
    const batch = JSON.parse(request.body).batch;
    assert.deepEqual(batch.map(event => event.event), names.map(name => `dd_${name}`));
    for (const event of batch) {
      assert.equal(event.distinct_id, id);
      assert.deepEqual(Object.keys(event.properties).sort(), ['adapter', 'surface', 'environment', 'schema_version', 'runtime_version', '$geoip_disable', '$process_person_profile'].sort());
      assert.equal(event.properties.$geoip_disable, true);
      assert.equal(event.properties.$process_person_profile, false);
    }
  } finally { analytics.close(); }
});
test('consent and valid configuration are required; arbitrary content never leaves the device', async () => {
  const payloads = [];
  const analytics = createAnalytics({ ...config, fetch: async (_, request) => { payloads.push(JSON.parse(request.body)); return { ok: true }; } });
  analytics.capture('learning_enabled'); await analytics.flush(); assert.equal(payloads.length, 0);
  analytics.setEnabled(true);
  analytics.capture('arbitrary_content', { answer: 'secret' });
  analytics.capture('moment_offered', { kind: 'predict', session_id: '/Users/private/project', moment_id: id, body: 'secret code', error: 'private text', count: 10 });
  await analytics.flush();
  assert.equal(payloads.length, 1);
  const event = payloads[0].batch[0];
  assert.equal(event.event, 'dd_moment_offered'); assert.equal(event.distinct_id, id);
  assert.equal(event.properties.kind, 'predict'); assert.equal(event.properties.moment_id, id);
  for (const key of ['session_id', 'body', 'error', 'count']) assert.equal(key in event.properties, false);
  assert.equal(event.properties.$geoip_disable, true); assert.equal(event.properties.$process_person_profile, false);
  assert.equal(event.properties.adapter, 'opencode'); assert.equal(event.properties.surface, 'gui');
  assert.doesNotMatch(JSON.stringify(payloads), /secret|private|Users/);
  analytics.setEnabled(false); analytics.capture('learning_enabled'); await analytics.flush();
  assert.equal(payloads.length, 1); analytics.close();
});
test('queue is bounded, disabling drops pending data, and failed requests are not retried forever', async () => {
  let requests = 0;
  const analytics = createAnalytics({ ...config, maxQueue: 3, batchSize: 3, flushIntervalMs: 60000, fetch: async () => { requests++; throw new Error('offline'); } });
  analytics.setEnabled(true);
  for (let n = 0; n < 50; n++) analytics.capture('learning_enabled');
  assert.ok(analytics.status().queued <= 3);
  await analytics.flush(); assert.equal(requests, 1); assert.equal(analytics.status().queued, 0);
  analytics.capture('learning_enabled'); analytics.setEnabled(false); await analytics.flush();
  assert.equal(requests, 1); analytics.close();
});
test('hung transport is bounded even if fetch ignores abort; revocation aborts in-flight work', async () => {
  let signal;
  const analytics = createAnalytics({ ...config, timeoutMs: 20, fetch: async (_, request) => { signal = request.signal; return new Promise(() => {}); } });
  analytics.setEnabled(true); analytics.capture('learning_enabled');
  const start = Date.now(); await analytics.flush();
  assert.ok(Date.now() - start < 500); assert.equal(signal.aborted, true);
  analytics.capture('learning_enabled'); const pending = analytics.flush(); analytics.setEnabled(false);
  assert.equal(signal.aborted, true); await pending; analytics.close();
});
test('missing token, management secret, non-HTTPS or unknown host configuration fails closed', async () => {
  for (const invalid of [{ token: '' }, { token: 'phx_secret' }, { host: 'http://us.i.posthog.com' }, { host: 'https://attacker.test' }, { distinctId: 'email@example.com' }]) {
    let requests = 0;
    const analytics = createAnalytics({ ...config, ...invalid, fetch: async () => { requests++; return { ok: true }; } });
    analytics.setEnabled(true); analytics.capture('learning_enabled'); await analytics.flush();
    assert.equal(requests, 0); assert.equal(analytics.status().configured, false); analytics.close();
  }
});
test('all supported moment formats keep their categorical kind; arbitrary strings are dropped', async () => {
  const kinds = ['explain', 'predict', 'multiple_choice', 'explain_back', 'what_if', 'demonstrate', 'mind_map', 'recap', 'trace', 'diagnose'];
  let batch;
  const analytics = createAnalytics({ ...config, fetch: async (_, req) => { batch = JSON.parse(req.body).batch; return { ok: true }; } });
  analytics.setEnabled(true);
  for (const kind of [...kinds, 'PRIVATE_MESSAGE']) analytics.capture('moment_offered', { kind });
  await analytics.flush(); assert.deepEqual(batch.slice(0, -1).map(event => event.properties.kind), kinds);
  assert.equal('kind' in batch.at(-1).properties, false); analytics.close();
});
