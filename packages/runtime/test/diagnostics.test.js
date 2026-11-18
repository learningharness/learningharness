import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diagnosticEntry, diagnosticError } from '../src/diagnostics.js';
import { createLocalDiagnostics } from '../src/node-diagnostics.js';
test('diagnostics allowlist correlation and counts, excluding content and raw errors', () => {
  const entry = diagnosticEntry('model_failed', { sessionID: 'ses_fixture', intent: 'goals', durationMs: 40, usage: 'estimated', prompt: 'PRIVATE_PROMPT', error: 'PRIVATE_ERROR', message: 'PRIVATE_MESSAGE', path: 'PRIVATE_PATH', model: 'PRIVATE_MODEL' });
  assert.equal(entry.sessionID, 'ses_fixture'); assert.equal(entry.durationMs, 40); assert.equal(entry.usage, 'estimated');
  assert.doesNotMatch(JSON.stringify(entry), /PRIVATE/);
  assert.equal(diagnosticEntry('PRIVATE_EVENT'), null);
  assert.equal(diagnosticError(new Error('Invalid skill ID: PRIVATE_VALUE')), 'skill_id');
});
test('local diagnostic writer flushes private bounded JSONL and rotates one file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dd-diagnostics-'));
  try {
    const log = createLocalDiagnostics({ directory, maxBytes: 500 });
    for (let i=0;i<8;i++) { log.record({ event: 'model_completed', sessionID: 'ses_fixture', intent: 'goals', inputTokens: i, prompt: 'PRIVATE_PROMPT' }); await log.flush(); }
    const current = await readFile(log.path, 'utf8'); const previous = await readFile(log.path + '.1', 'utf8');
    assert.ok((await stat(log.path)).size <= 500); assert.ok((await stat(log.path + '.1')).size <= 500);
    assert.equal((await stat(log.path)).mode & 0o777, 0o600);
    assert.ok(current.trim().split('\n').every(line => JSON.parse(line).event === 'model_completed'));
    assert.doesNotMatch(current + previous, /PRIVATE/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
