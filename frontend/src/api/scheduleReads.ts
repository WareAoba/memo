import { scheduleGeneration } from './scheduleChanges';
import { trackScopeKey } from './trackScope';

type Pending = { controller: AbortController; promise: Promise<unknown>; users: number };
const pending = new Map<string, Pending>();

// Only share in-flight reads. Completed values are discarded; refreshes always read the server.
// Each caller owns its cancellation; the transport ends when the last caller leaves.
export function readSchedules<T>(
  key: string,
  read: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  key = `${trackScopeKey()}:${scheduleGeneration()}:${key}`;
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, promise: read(controller.signal), users: 0 };
    pending.set(key, entry);
  }
  const shared = entry;
  shared.users++;
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    function finish() {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', abort);
      shared.users--;
      if (shared.users === 0) {
        if (pending.get(key) === shared) pending.delete(key);
        shared.controller.abort();
      }
      return true;
    }
    function abort() {
      if (finish()) reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', abort, { once: true });
    shared.promise.then(
      (value) => {
        if (finish()) resolve(value as T);
      },
      (error: unknown) => {
        if (finish()) reject(error);
      },
    );
  });
}
