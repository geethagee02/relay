export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Status = 'open' | 'acknowledged' | 'resolved';
export type PhotoKind = 'graph' | 'dashboard' | 'runbook' | 'pager';

export type Handoff = {
  id: string;
  title: string;
  notes: string;
  severity: Severity;
  status: Status;
  service: string;
  author: string;
  photoKind: PhotoKind | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateHandoffInput = {
  title: string;
  notes: string;
  severity: Severity;
  service: string;
  author: string;
  photoKind: PhotoKind | null;
};

export type OutboxCreate = {
  op: 'create';
  handoff: Handoff;
  attempts: number;
  lastError?: string;
  rejected?: boolean;
  enqueuedAt: string;
};

export type OutboxStatus = {
  op: 'status';
  handoffId: string;
  status: Status;
  attempts: number;
  lastError?: string;
  rejected?: boolean;
  enqueuedAt: string;
};

export type OutboxItem = OutboxCreate | OutboxStatus;

export type HandoffView = Handoff & {
  pending: boolean;
  lastError?: string;
  attempts: number;
  rejected: boolean;
};

const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical'];
const STATUSES: readonly Status[] = ['open', 'acknowledged', 'resolved'];
const PHOTO_KINDS: readonly PhotoKind[] = ['graph', 'dashboard', 'runbook', 'pager'];

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && SEVERITIES.includes(value as Severity);
}

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && STATUSES.includes(value as Status);
}

export function isPhotoKind(value: unknown): value is PhotoKind {
  return typeof value === 'string' && PHOTO_KINDS.includes(value as PhotoKind);
}

export function statusRank(status: Status): number {
  switch (status) {
    case 'open':
      return 0;
    case 'acknowledged':
      return 1;
    case 'resolved':
      return 2;
  }
}

export function canAdvance(from: Status, to: Status): boolean {
  return statusRank(to) > statusRank(from);
}

export function isHandoff(value: unknown): value is Handoff {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.notes === 'string' &&
    isSeverity(row.severity) &&
    isStatus(row.status) &&
    typeof row.service === 'string' &&
    typeof row.author === 'string' &&
    (row.photoKind === null || isPhotoKind(row.photoKind)) &&
    typeof row.createdAt === 'string' &&
    typeof row.updatedAt === 'string'
  );
}

export function isOutboxItem(value: unknown): value is OutboxItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.attempts !== 'number' || !Number.isFinite(row.attempts)) return false;
  if (typeof row.enqueuedAt !== 'string') return false;
  if (row.lastError !== undefined && typeof row.lastError !== 'string') return false;
  if (row.rejected !== undefined && typeof row.rejected !== 'boolean') return false;
  if (row.op === 'create') return isHandoff(row.handoff);
  if (row.op === 'status') return typeof row.handoffId === 'string' && isStatus(row.status);
  return false;
}

export function mergeHandoffs(cache: readonly Handoff[], outbox: readonly OutboxItem[]): HandoffView[] {
  const byId = new Map<string, HandoffView>();
  for (const handoff of cache) {
    byId.set(handoff.id, {
      ...handoff,
      pending: false,
      attempts: 0,
      rejected: false,
    });
  }

  for (const item of outbox) {
    if (item.op !== 'create') continue;
    byId.set(item.handoff.id, {
      ...item.handoff,
      pending: true,
      lastError: item.lastError,
      attempts: item.attempts,
      rejected: item.rejected === true,
    });
  }

  for (const item of outbox) {
    if (item.op !== 'status') continue;
    const existing = byId.get(item.handoffId);
    if (!existing || !canAdvance(existing.status, item.status)) continue;
    byId.set(item.handoffId, {
      ...existing,
      status: item.status,
      updatedAt: item.enqueuedAt,
      pending: true,
      lastError: item.lastError,
      attempts: item.attempts,
      rejected: item.rejected === true,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * A status change for a create that has not been acknowledged by the server
 * updates that create. We never queue a PATCH for a handoff the server has
 * not seen.
 */
export function foldStatus(
  outbox: readonly OutboxItem[],
  handoffId: string,
  status: Status,
  now: string,
): readonly OutboxItem[] {
  const index = outbox.findIndex((item) => item.op === 'create' && item.handoff.id === handoffId);
  if (index !== -1) {
    const current = outbox[index];
    if (!current || current.op !== 'create' || !canAdvance(current.handoff.status, status)) {
      return outbox;
    }
    const next = outbox.slice();
    next[index] = {
      ...current,
      attempts: 0,
      lastError: undefined,
      rejected: false,
      handoff: { ...current.handoff, status, updatedAt: now },
    };
    return next;
  }

  const without = outbox.filter((item) => !(item.op === 'status' && item.handoffId === handoffId));
  return [
    ...without,
    {
      op: 'status',
      handoffId,
      status,
      attempts: 0,
      enqueuedAt: now,
    },
  ];
}
