import {userDataRoot,migrateLocalDirectory} from '../../hosts/src/user-data.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAnalytics } from './posthog.js';

export const analyticsDirectory = () => userDataRoot();
export async function loadNodeAnalytics({ directory = analyticsDirectory(), env = process.env, adapter = 'fixture', surface = 'companion', fetch = globalThis.fetch } = {}) {
  const disabled = () => createAnalytics();
  try {
    if(directory===userDataRoot())await migrateLocalDirectory(join(homedir(),'.local/share/dontdumb'),directory,{entries:['analytics.json','analytics-identity.json']});
    let config = {};
    try { config = JSON.parse(await readFile(join(directory, 'analytics.json'), 'utf8')); } catch { /* optional */ }
    const token = env.LEARNING_HARNESS_POSTHOG_TOKEN ?? env.DONTDUMB_POSTHOG_TOKEN ?? config.token;
    const host = env.LEARNING_HARNESS_POSTHOG_HOST ?? env.DONTDUMB_POSTHOG_HOST ?? config.host ?? 'https://us.i.posthog.com';
    if (typeof token !== 'string' || !/^phc_[a-zA-Z0-9_-]+$/.test(token) || !['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)) return disabled();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = join(directory, 'analytics-identity.json');
    try { await writeFile(file, JSON.stringify({ id: randomUUID() }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const { id } = JSON.parse(await readFile(file, 'utf8'));
    return createAnalytics({ token, host, distinctId: id, adapter, surface, environment: env.LEARNING_HARNESS_ANALYTICS_ENVIRONMENT ?? env.DONTDUMB_ANALYTICS_ENVIRONMENT ?? config.environment ?? 'pilot', fetch });
  } catch { return disabled(); }
}
