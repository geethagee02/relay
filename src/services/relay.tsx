import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { CreateHandoffInput, Handoff, HandoffView, Status } from '../domain/handoff';
import { createSyncEngine, type Online, type SyncEngine } from './sync-engine';

export type RelayContextValue = {
  handoffs: HandoffView[];
  hydrated: boolean;
  syncing: boolean;
  online: Online;
  lastSyncedAt: string | null;
  pendingCount: number;
  handle: string;
  sync: SyncEngine['sync'];
  create: (input: CreateHandoffInput) => Promise<Handoff>;
  setStatus: (id: string, status: Status) => Promise<void>;
  setHandle: (handle: string) => Promise<void>;
};

const RelayContext = createContext<RelayContextValue | null>(null);

export function RelayProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => createSyncEngine(), []);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);

  useEffect(() => {
    void engine.hydrate();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void engine.sync({ includeRejected: true });
    });
    const timer = setInterval(() => {
      void engine.sync();
    }, 20000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [engine]);

  const value = useMemo<RelayContextValue>(
    () => ({
      handoffs: snapshot.handoffs,
      hydrated: snapshot.hydrated,
      syncing: snapshot.syncing,
      online: snapshot.online,
      lastSyncedAt: snapshot.lastSyncedAt,
      pendingCount: snapshot.pendingCount,
      handle: snapshot.handle,
      sync: engine.sync,
      create: engine.create,
      setStatus: engine.setStatus,
      setHandle: engine.setHandle,
    }),
    [engine, snapshot],
  );

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay(): RelayContextValue {
  const value = useContext(RelayContext);
  if (!value) throw new Error('useRelay must be used within RelayProvider');
  return value;
}
