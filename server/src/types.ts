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
