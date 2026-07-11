import type { CommitIdentity } from '../../../shared/domain';

const SIGNATURE_LABELS: Record<string, string> = {
  G: 'Good signature',
  B: 'Bad signature',
  U: 'Good signature (unknown trust)',
  X: 'Expired signature',
  Y: 'Expired key',
  R: 'Revoked key',
  E: 'Cannot verify signature',
  N: 'Not signed',
};

export function formatCommitIdentity(identity: CommitIdentity): string {
  if (!identity.email) return identity.name;
  return `${identity.name} <${identity.email}>`;
}

export function formatCommitDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function signatureStatusLabel(status: string): string {
  return SIGNATURE_LABELS[status] ?? `Unknown status (${status || '-'})`;
}
