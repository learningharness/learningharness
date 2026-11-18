export interface RetryOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}
const methods = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']);
const statuses = new Set([429, 502, 503, 504]);

/** Race even injected dependencies against cancellation; always remove listeners. */
async function abortable<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([work(), aborted]); }
  finally { signal.removeEventListener('abort', onAbort); }
}
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, Math.min(ms, 2 ** 31 - 1));
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export function createRetryFetch(options: RetryOptions = {}): typeof fetch {
  const { fetch: send = globalThis.fetch, sleep = defaultSleep, random = Math.random,
    now = Date.now, maxRetries = 3, baseDelayMs = 250, maxDelayMs = 30_000 } = options;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new RangeError('Invalid maxRetries');
  for (const delay of [baseDelayMs, maxDelayMs]) {
    if (!Number.isFinite(delay) || delay < 0) throw new RangeError('Invalid delay');
  }
  return async (input, init) => {
    const request = new Request(input, init);
    const signal = request.signal;
    // Streaming bodies cannot safely be replayed without unbounded buffering.
    const streaming = init?.body instanceof ReadableStream || (input instanceof Request && input.body !== null);
    const retries = methods.has(request.method) && !streaming ? maxRetries : 0;
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      let response: Response | undefined;
      try { response = await abortable(() => send(request.clone()), signal); }
      catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof TypeError) || attempt >= retries) throw error;
      }
      if (response && (!statuses.has(response.status) || attempt >= retries)) return response;
      let delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * random();
      const header = response?.headers.get('Retry-After');
      if (header) {
        const seconds = /^\d+(?:\.\d+)?$/.test(header.trim()) ? Number(header) : NaN;
        const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now();
        if (Number.isFinite(requested)) delay = Math.max(delay, requested);
      }
      if (response?.body) await response.body.cancel().catch(() => {});
      // Chunk long waits to avoid timer overflow, preserving Retry-After.
      while (delay > 0) {
        const chunk = Math.min(delay, 2 ** 31 - 1);
        await abortable(() => sleep(chunk, signal), signal);
        delay -= chunk;
      }
    }
  };
}
