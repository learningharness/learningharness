import { appendFile, mkdir, rename, stat, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { diagnosticEntry } from './diagnostics.js';
// Bounded asynchronous JSONL, outside the work project. One rotated file.
/** @param {{ directory: string, maxBytes?: number, maxQueue?: number }} options */
export function createLocalDiagnostics({ directory, maxBytes = 1_000_000, maxQueue = 100 }) {
  const path = join(directory, 'diagnostics.jsonl'); let pending = []; let draining; let dropped = 0; let failed = 0;
  async function drain() {
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      while (pending.length) {
        const entry = pending.shift(); const line = JSON.stringify(entry) + '\n';
        let size = 0; try { size = (await stat(path)).size; } catch {}
        if (size + Buffer.byteLength(line) > maxBytes) await rename(path, path + '.1');
        await appendFile(path, line, { mode: 0o600 }); await chmod(path, 0o600);
      }
    } catch { failed++; pending = []; }
  }
  const start = () => { if (!draining) draining = drain().finally(() => { draining = null; if (pending.length) start(); }); };
  return {
    record(value) {
      const entry = diagnosticEntry(value?.event, value);
      if (!entry) return;
      if (pending.length >= maxQueue) { pending.shift(); dropped++; }
      pending.push(entry); start();
    },
    async flush() { while (draining) await draining; },
    status: () => ({ queued: pending.length, dropped, failed }), path
  };
}
