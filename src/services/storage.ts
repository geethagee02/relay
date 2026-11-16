import AsyncStorage from '@react-native-async-storage/async-storage';

import { isHandoff, isOutboxItem, type Handoff, type OutboxItem } from '../domain/handoff';

const KEYS = {
  cache: 'relay.cache.handoffs.v1',
  outbox: 'relay.outbox.v1',
  handle: 'relay.engineer.v1',
} as const;

async function readArray<T>(key: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

export function loadCache(): Promise<Handoff[]> {
  return readArray(KEYS.cache, isHandoff);
}

export function saveCache(handoffs: readonly Handoff[]): Promise<void> {
  return AsyncStorage.setItem(KEYS.cache, JSON.stringify(handoffs));
}

export function loadOutbox(): Promise<OutboxItem[]> {
  return readArray(KEYS.outbox, isOutboxItem);
}

export function saveOutbox(items: readonly OutboxItem[]): Promise<void> {
  return AsyncStorage.setItem(KEYS.outbox, JSON.stringify(items));
}

export async function loadHandle(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEYS.handle);
  const trimmed = raw?.trim() ?? '';
  return trimmed || null;
}

export function saveHandle(handle: string): Promise<void> {
  return AsyncStorage.setItem(KEYS.handle, handle);
}
