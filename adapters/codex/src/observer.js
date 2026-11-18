import { createHash } from 'node:crypto';
import {normalizePublicItem as normalizeItem} from '../../../packages/hosts/src/public-work.js';
export {normalizeItem};
export class CodexObserver {
  constructor({ rpc, onEvent, getSeen = () => [], getTaskId = () => null, onCheckpoint = async () => {} }) { this.rpc = rpc; this.onEvent = onEvent; this.getSeen = getSeen; this.getTaskId = getTaskId; this.onCheckpoint = onCheckpoint; this.seen = new Map(); this.threadId = null; this.running = false; }
  attach(threadId) { this.threadId = threadId; this.seen = new Map(threadId ? (this.getSeen(threadId) ?? []).filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && /^[0-9a-f]{64}$/.test(entry[1])).slice(-300) : []); }
  async poll() {
    if (this.running || !this.threadId) return;
    this.running = true; const id = this.threadId;
    try {
      const turns = await this.rpc.request('thread/turns/list', { threadId: id, limit: 2, itemsView: 'notLoaded' });
      const events = [];
      for (const turn of [...turns.data].reverse()) {
        if (id !== this.threadId) return;
        const page = await this.rpc.request('thread/items/list', { threadId: id, turnId: turn.id, limit: 30, sortDirection: 'desc' });
        for (const entry of [...page.data].reverse()) events.push(...normalizeItem(id, turn.id, entry.item));
      }
      // Migrate older stores without a cursor: don't replay tasks before the
      // last selected task and reset its automatic-generation budget.
      const currentTask = this.getTaskId(id);
      const marker = currentTask ? events.findIndex(event => event.type === 'task.submitted' && event.id === currentTask) : -1;
      let changed = false;
      for (const [index, event] of events.entries()) {
        if (id !== this.threadId) return;
        const hash = createHash('sha256').update(JSON.stringify(event.data)).digest('hex');
        if (this.seen.get(event.id) === hash) continue;
        if (marker < 0 || index >= marker) await this.onEvent(event);
        this.seen.set(event.id, hash); changed = true;
      }
      while (this.seen.size > 300) this.seen.delete(this.seen.keys().next().value);
      if (changed) await this.onCheckpoint(id, [...this.seen]);
    } finally { this.running = false; }
  }
}
