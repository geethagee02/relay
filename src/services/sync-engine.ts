import {
  canAdvance,
  foldStatus,
  mergeHandoffs,
  type CreateHandoffInput,
  type Handoff,
  type HandoffView,
  type OutboxItem,
  type Status,
} from '../domain/handoff';
import { ApiError, createHandoff, listHandoffs, setStatus as apiSetStatus } from './api';
import { createId } from './id';
import { loadCache, loadHandle, loadOutbox, saveCache, saveHandle, saveOutbox } from './storage';

/**
 * The outbox is the source of truth for anything the server has not
 * acknowledged. The cache is the last list the server returned. Screens
 * render mergeHandoffs(cache, outbox).
 *
 * Creates carry a client uuid. The server treats a repeated POST as the
 * same handoff and will only move status forward, so a retry after a lost
 * response cannot duplicate a note or rewind it.
 *
 * A status change on a create that is still queued updates that create in
 * place. A PATCH is never sent for a handoff the server has not seen.
 * If the engineer advances status while a POST is in flight, the queued
 * snapshot is kept and sent again; the server will not rewind status.
 */

export type Online = 'unknown' | 'ok' | 'offline';

export type EngineSnapshot = {
  cache: Handoff[];
  outbox: OutboxItem[];
  handoffs: HandoffView[];
  pendingCount: number;
  handle: string;
  hydrated: boolean;
  syncing: boolean;
  online: Online;
  lastSyncedAt: string | null;
};

type Listener = () => void;

type SyncOptions = {
  includeRejected?: boolean;
};

function sameKey(a: OutboxItem, b: OutboxItem): boolean {
  if (a.op === 'create' && b.op === 'create') return a.handoff.id === b.handoff.id;
  if (a.op === 'status' && b.op === 'status') return a.handoffId === b.handoffId;
  return false;
}

function snapshotMatches(item: OutboxItem, sent: OutboxItem): boolean {
  if (item.op === 'create' && sent.op === 'create') {
    return item.handoff.status === sent.handoff.status && item.handoff.updatedAt === sent.handoff.updatedAt;
  }
  if (item.op === 'status' && sent.op === 'status') {
    return item.status === sent.status && item.enqueuedAt === sent.enqueuedAt;
  }
  return false;
}

function upsert(cache: readonly Handoff[], handoff: Handoff): Handoff[] {
  const index = cache.findIndex((item) => item.id === handoff.id);
  if (index === -1) return [handoff, ...cache];
  const next = cache.slice();
  next[index] = handoff;
  return next;
}

function classify(error: unknown): { message: string; retryable: boolean; status: number } {
  if (error instanceof ApiError) {
    return { message: error.message, retryable: error.retryable, status: error.status };
  }
  return { message: 'Something went wrong before the API answered', retryable: true, status: 0 };
}

function trimInput(input: CreateHandoffInput): Omit<CreateHandoffInput, 'photoKind'> & { photoKind: CreateHandoffInput['photoKind'] } {
  return {
    title: input.title.trim(),
    notes: input.notes.trim(),
    severity: input.severity,
    service: input.service.trim(),
    author: input.author.trim(),
    photoKind: input.photoKind,
  };
}

export type SyncEngine = {
  subscribe: (listener: Listener) => () => void;
  getState: () => EngineSnapshot;
  hydrate: () => Promise<void>;
  sync: (options?: SyncOptions) => Promise<void>;
  create: (input: CreateHandoffInput) => Promise<Handoff>;
  setStatus: (id: string, status: Status) => Promise<void>;
  setHandle: (handle: string) => Promise<void>;
};

export function createSyncEngine(): SyncEngine {
  let state: EngineSnapshot = {
    cache: [],
    outbox: [],
    handoffs: [],
    pendingCount: 0,
    handle: 'primary',
    hydrated: false,
    syncing: false,
    online: 'unknown',
    lastSyncedAt: null,
  };
  const listeners = new Set<Listener>();
  let chain: Promise<void> = Promise.resolve();
  let inFlight: Promise<void> | null = null;
  let flushAgain = false;
  let retryRejected = false;
  let hydratePromise: Promise<void> | null = null;

  function setState(patch: Partial<Omit<EngineSnapshot, 'handoffs' | 'pendingCount'>>) {
    const cache = patch.cache ?? state.cache;
    const outbox = patch.outbox ?? state.outbox;
    const handoffs =
      cache === state.cache && outbox === state.outbox ? state.handoffs : mergeHandoffs(cache, outbox);
    state = {
      ...state,
      ...patch,
      cache,
      outbox,
      handoffs,
      pendingCount: outbox.length,
    };
    for (const listener of [...listeners]) listener();
  }

  function mutate(task: () => Promise<void> | void): Promise<void> {
    const run = chain.then(task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function refresh(): Promise<void> {
    try {
      const list = await listHandoffs();
      await mutate(async () => {
        await saveCache(list);
        setState({ cache: list, online: 'ok', lastSyncedAt: new Date().toISOString() });
      });
    } catch {
      setState({ online: 'offline' });
    }
  }

  async function markFailure(sent: OutboxItem, failure: { message: string; retryable: boolean }): Promise<void> {
    await mutate(async () => {
      let changed = false;
      const outbox = state.outbox.map((item) => {
        if (!(sameKey(item, sent) && snapshotMatches(item, sent))) return item;
        changed = true;
        return {
          ...item,
          attempts: item.attempts + 1,
          lastError: failure.message,
          rejected: failure.retryable ? item.rejected === true : true,
        };
      });
      if (!changed) return;
      await saveOutbox(outbox);
      setState({ outbox, online: failure.retryable ? 'offline' : state.online });
    });
  }

  async function dropSent(sent: OutboxItem, saved?: Handoff): Promise<void> {
    await mutate(async () => {
      const outbox = state.outbox.filter((item) => !(sameKey(item, sent) && snapshotMatches(item, sent)));
      const cache = saved ? upsert(state.cache, saved) : state.cache;
      const outboxChanged = outbox.length !== state.outbox.length;
      if (!outboxChanged && !saved) return;
      if (outboxChanged) await saveOutbox(outbox);
      if (saved) await saveCache(cache);
      setState({
        outbox: outboxChanged ? outbox : state.outbox,
        cache: saved ? cache : state.cache,
        online: saved ? 'ok' : state.online,
      });
    });
  }

  async function flushOnce(includeRejected: boolean): Promise<boolean> {
    const queue = state.outbox.slice();
    for (const candidate of queue) {
      const sent = state.outbox.find((item) => sameKey(item, candidate) && snapshotMatches(item, candidate));
      if (!sent || (sent.rejected && !includeRejected)) continue;

      try {
        const saved = sent.op === 'create' ? await createHandoff(sent.handoff) : await apiSetStatus(sent.handoffId, sent.status);
        await dropSent(sent, saved);
      } catch (error) {
        const failure = classify(error);
        if (sent.op === 'status' && (failure.status === 404 || failure.status === 409)) {
          await dropSent(sent);
          continue;
        }
        await markFailure(sent, failure);
        if (failure.retryable) return true;
      }
    }
    return false;
  }

  async function drain(): Promise<void> {
    setState({ syncing: true });
    try {
      for (;;) {
        const includeRejected = retryRejected;
        retryRejected = false;
        flushAgain = false;
        const networkFailed = await flushOnce(includeRejected);
        if (networkFailed) setState({ online: 'offline' });
        if (!networkFailed) await refresh();
        if (!flushAgain) return;
      }
    } catch (error) {
      console.warn(error);
      setState({ online: 'offline' });
    } finally {
      inFlight = null;
      setState({ syncing: false });
    }
  }

  function sync(options?: SyncOptions): Promise<void> {
    if (!state.hydrated) return Promise.resolve();
    if (options?.includeRejected) retryRejected = true;
    if (inFlight) {
      flushAgain = true;
      return inFlight;
    }
    // Assign the lock before drain touches state. drain() would otherwise
    // run until its first await, and a listener could start a second drain.
    inFlight = Promise.resolve().then(drain);
    return inFlight;
  }

  async function hydrate(): Promise<void> {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        const [cache, outbox, handle] = await Promise.all([loadCache(), loadOutbox(), loadHandle()]);
        setState({
          cache,
          outbox,
          handle: handle ?? 'primary',
          hydrated: true,
        });
      } catch {
        setState({ hydrated: true, online: 'offline' });
      }
      await sync({ includeRejected: true });
    })();
    return hydratePromise;
  }

  async function create(input: CreateHandoffInput): Promise<Handoff> {
    if (!state.hydrated) throw new Error('Relay is still opening its local log');
    const cleaned = trimInput(input);
    const now = new Date().toISOString();
    const handoff: Handoff = {
      id: createId(),
      ...cleaned,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    await mutate(async () => {
      const outbox: OutboxItem[] = [
        ...state.outbox,
        { op: 'create', handoff, attempts: 0, enqueuedAt: now },
      ];
      await saveOutbox(outbox);
      setState({ outbox });
    });
    void sync();
    return handoff;
  }

  async function setStatus(id: string, status: Status): Promise<void> {
    if (!state.hydrated) throw new Error('Relay is still opening its local log');
    let queued = false;
    await mutate(async () => {
      const view = mergeHandoffs(state.cache, state.outbox).find((item) => item.id === id);
      if (!view || !canAdvance(view.status, status)) return;
      const outbox = foldStatus(state.outbox, id, status, new Date().toISOString());
      if (outbox === state.outbox) return;
      await saveOutbox(outbox);
      setState({ outbox: [...outbox] });
      queued = true;
    });
    if (queued) void sync();
  }

  async function setHandle(handle: string): Promise<void> {
    const cleaned = handle.trim() || 'primary';
    await mutate(async () => {
      await saveHandle(cleaned);
      setState({ handle: cleaned });
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    hydrate,
    sync,
    create,
    setStatus,
    setHandle,
  };
}
