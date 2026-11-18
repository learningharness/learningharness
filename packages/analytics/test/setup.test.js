import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
test('setup saves capture configuration without sending events or changing a saved runtime preference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dd-posthog-setup-'));
  try {
    const output = execFileSync(process.execPath, ['scripts/setup-posthog.mjs', '--directory', directory], {
      cwd: new URL('../../../', import.meta.url), encoding: 'utf8', env: { ...process.env, DONTDUMB_POSTHOG_TOKEN: 'phc_setup_fixture', DONTDUMB_POSTHOG_HOST: 'https://eu.i.posthog.com' }
    });
    const config = JSON.parse(await readFile(join(directory, 'analytics.json'), 'utf8'));
    assert.deepEqual(config, { token: 'phc_setup_fixture', host: 'https://eu.i.posthog.com', environment: process.env.DONTDUMB_ANALYTICS_ENVIRONMENT ?? 'pilot' });
    assert.equal((await stat(join(directory, 'analytics.json'))).mode & 0o777, 0o600);
    assert.match(output, /This setup command sent no event/); assert.doesNotMatch(output, /phc_setup_fixture/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
