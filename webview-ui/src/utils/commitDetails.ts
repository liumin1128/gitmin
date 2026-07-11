import type { CommitIdentity } from '../../../shared/domain';

const SIGNATURE_LABELS: Record<string, string> = {
  G: '有效签名',
  B: '签名错误',
  U: '有效签名（信任级别未知）',
  X: '签名已过期',
  Y: '签名密钥已过期',
  R: '签名密钥已撤销',
  E: '无法验证签名',
  N: '未签名',
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
  return SIGNATURE_LABELS[status] ?? `未知状态（${status || '-'}）`;
}
