import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadNodeAnalytics } from '../src/node-config.js';
import { LearningEngine } from '../../runtime/src/learning-engine.js';

test('native Codex configuration captures metadata by default and respects a persisted opt-out', async () => {
 const directory=await mkdtemp(join(tmpdir(),'lh-native-analytics-'));
 try {
  const sent=[];
  const options={directory,env:{DONTDUMB_POSTHOG_TOKEN:'phc_test'},adapter:'codex',surface:'native',fetch:async(_,request)=>{sent.push(JSON.parse(request.body));return {ok:true};}};
  const analytics=await loadNodeAnalytics(options);
  let saved;const storage={get:async()=>saved,set:async(_,value)=>{saved=structuredClone(value);}};
  const ports={storage,gateway:{generate:async()=>{throw Error('Unexpected model call');}},capabilities:{host:'codex',observation:{kinds:[]},model:{independent:true},surface:{embedded:true}}};
  const engine=new LearningEngine({...ports,analytics});await engine.load();await analytics.flush();
  assert.equal(engine.snapshot().analytics.enabled,true);
  assert.equal(sent[0].batch[0].event,'dd_runtime_started');
  assert.equal(sent[0].batch[0].properties.surface,'native');
  await engine.command({action:'set-analytics',value:false});analytics.close();
  const restarted=await loadNodeAnalytics(options);const before=sent.length;
  await new LearningEngine({...ports,analytics:restarted}).load();await restarted.flush();
  assert.equal(restarted.status().enabled,false);assert.equal(sent.length,before);restarted.close();
 } finally {await rm(directory,{recursive:true,force:true});}
});

test('local identity is stable across restarts and config does not enable reporting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dd-analytics-'));
  try {
    await writeFile(join(directory, 'analytics.json'), JSON.stringify({ token: 'phc_test', host: 'https://eu.i.posthog.com' }));
    const sent = [];
    const options = { directory, env: {}, adapter: 'opencode', surface: 'gui', fetch: async (_, req) => { sent.push(JSON.parse(req.body)); return { ok: true }; } };
    const first = await loadNodeAnalytics(options); assert.equal(first.status().enabled, false);
    first.setEnabled(true); first.capture('learning_enabled'); await first.flush(); first.close();
    const second = await loadNodeAnalytics(options); second.setEnabled(true); second.capture('learning_enabled'); await second.flush(); second.close();
    assert.equal(sent[0].batch[0].distinct_id, sent[1].batch[0].distinct_id);
    assert.deepEqual(Object.keys(JSON.parse(await readFile(join(directory, 'analytics-identity.json'), 'utf8'))), ['id']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('absent, malformed or unreadable configuration never prevents startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dd-analytics-'));
  try {
    for (const content of [null, 'invalid JSON', JSON.stringify({ token: 'phx_secret', host: 'https://us.i.posthog.com' })]) {
      if (content !== null) await writeFile(join(directory, 'analytics.json'), content);
      const analytics = await loadNodeAnalytics({ directory, env: {}, adapter: 'opencode', surface: 'gui' });
      assert.equal(analytics.status().configured, false); analytics.close();
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
