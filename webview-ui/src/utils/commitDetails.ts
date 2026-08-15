import type { CommitIdentity } from '../../../shared/domain';
import {
  localeLanguageTag,
  t,
  type TranslationKey,
} from '../../../shared/i18n';

const SIGNATURE_LABEL_KEYS: Record<string, TranslationKey> = {
  G: 'signature.good',
  B: 'signature.bad',
  U: 'signature.unknownTrust',
  X: 'signature.expired',
  Y: 'signature.expiredKey',
  R: 'signature.revokedKey',
  E: 'signature.cannotVerify',
  N: 'signature.notSigned',
};

export function formatCommitIdentity(identity: CommitIdentity): string {
  if (!identity.email) return identity.name;
  return `${identity.name} <${identity.email}>`;
}

export function formatCommitDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(localeLanguageTag());
}

export function signatureStatusLabel(status: string): string {
  const key = SIGNATURE_LABEL_KEYS[status];
  return key ? t(key) : t('signature.unknown', { status: status || '-' });
}
