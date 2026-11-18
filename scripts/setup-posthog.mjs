import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyticsDirectory } from '../packages/analytics/src/node-config.js';

// Run locally, not in a distributed plugin. Only a write-only project token is saved.
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Configure local PostHog capture. Use DONTDUMB_POSTHOG_TOKEN and DONTDUMB_POSTHOG_HOST, or answer the prompts. Optional --directory PATH is for isolated verification. Anonymous usage sharing defaults on when configured; an existing off preference is preserved. You can turn it off in learning settings.');
  process.exit(0);
}
const directoryIndex = args.indexOf('--directory');
const directory = directoryIndex >= 0 ? args[directoryIndex + 1] : analyticsDirectory();
if (!directory) throw new Error('A configuration directory is required');
let existing = {};
try { existing = JSON.parse(await readFile(join(directory, 'analytics.json'), 'utf8')); } catch {}
const prompts = createInterface({ input: stdin, output: stdout });
try {
  const token = process.env.DONTDUMB_POSTHOG_TOKEN || (stdin.isTTY ? (await prompts.question('PostHog project token (phc_): ')).trim() : existing.token);
  if (!token || !/^phc_[a-zA-Z0-9_-]+$/.test(token)) throw new Error('A public phc_ project token is required. Personal/admin keys must never be used for capture.');
  const region = process.env.DONTDUMB_POSTHOG_HOST || (stdin.isTTY ? (await prompts.question('Region: us or eu [us]: ')).trim() || 'us' : existing.host ?? 'us');
  const host = { us: 'https://us.i.posthog.com', eu: 'https://eu.i.posthog.com' }[region] ?? region;
  if (!['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)) throw new Error('Choose the US or EU PostHog Cloud ingestion host');
  const environment = process.env.DONTDUMB_ANALYTICS_ENVIRONMENT ?? existing.environment ?? 'pilot';
  if (!['development', 'pilot', 'production', 'test'].includes(environment)) throw new Error('Unknown analytics environment');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, 'analytics.json'), JSON.stringify({ token, host, environment }, null, 2) + '\n', { mode: 0o600 });
  console.log('PostHog capture configured locally. Restart OpenCode. Anonymous usage sharing defaults on when configured; any saved off preference is preserved. Change it in learning settings. This setup command sent no event.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { prompts.close(); }
