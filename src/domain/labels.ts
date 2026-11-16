import type { PhotoKind, Severity, Status } from './handoff';

export const SEVERITY_OPTIONS: readonly { value: Severity; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Watch' },
  { value: 'medium', label: 'Medium', hint: 'This shift' },
  { value: 'high', label: 'High', hint: 'Act now' },
  { value: 'critical', label: 'Critical', hint: 'Page' },
];

export const PHOTO_OPTIONS: readonly { value: PhotoKind; label: string; hint: string }[] = [
  { value: 'graph', label: 'Graph', hint: 'Latency or errors' },
  { value: 'dashboard', label: 'Dashboard', hint: 'A board you watched' },
  { value: 'runbook', label: 'Runbook', hint: 'The page you followed' },
  { value: 'pager', label: 'Pager', hint: 'The alert itself' },
];

export const SERVICE_SUGGESTIONS: readonly string[] = [
  'payments-api',
  'edge-proxy',
  'notifications',
  'auth',
  'data-pipeline',
];

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'critical':
      return 'Critical';
  }
}

export function statusLabel(status: Status): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'acknowledged':
      return 'Acknowledged';
    case 'resolved':
      return 'Resolved';
  }
}

export function photoLabel(kind: PhotoKind): string {
  switch (kind) {
    case 'graph':
      return 'Graph';
    case 'dashboard':
      return 'Dashboard';
    case 'runbook':
      return 'Runbook';
    case 'pager':
      return 'Pager';
  }
}
