import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
export async function localStorage(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, 'writer.lock'); let handle;
  try { handle = await open(lock, 'wx', 0o600); await handle.writeFile(String(process.pid)); }
  catch { throw new Error('LearningHarness companion is already running, or a stale writer.lock needs removal after confirming its process stopped'); }
  let queue = Promise.resolve();
  return {
    get: async () => { try { return JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Local learning state could not be read; existing state was preserved'); } },
    set: (_key, value) => { const text = JSON.stringify(value); const next = queue.then(async () => { const temp = join(directory, 'state.tmp'); await writeFile(temp, text, { mode: 0o600 }); await rename(temp, join(directory, 'state.json')); }); queue = next.catch(() => {}); return next; },
    close: async () => { await queue; await handle.close(); await unlink(lock); }
  };
}
