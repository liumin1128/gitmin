import type { ReactNode } from 'react';
import type { CommitDetails } from '../../../shared/domain';
import {
  formatCommitDate,
  formatCommitIdentity,
  signatureStatusLabel,
} from '../utils/commitDetails';

interface Props {
  details: CommitDetails[];
  loading: boolean;
  error: string | null;
}

export function CommitDetailsPanel({ details, loading, error }: Props) {
  if (loading) return <div className="empty-hint">Loading commit details...</div>;
  if (error) return <div className="commit-details-error">{error}</div>;
  if (details.length === 0) {
    return <div className="empty-hint">Select one or more commits to view details</div>;
  }

  return (
    <div className="commit-details-list">
      {details.map((detail) => (
        <CommitDetailItem key={detail.hash} detail={detail} />
      ))}
    </div>
  );
}

function CommitDetailItem({ detail }: { detail: CommitDetails }) {
  return (
    <article className="commit-detail-item">
      <header className="commit-detail-header">
        <h3>{detail.subject || '(no subject)'}</h3>
      </header>

      {detail.body.trim() && <pre className="commit-detail-body">{detail.body}</pre>}

      <dl className="commit-detail-grid">
        <DetailRow label="Hash"><code>{detail.hash}</code></DetailRow>
        <DetailRow label="Refs">
          {detail.refs.length > 0 ? (
            <span className="commit-detail-refs">
              {detail.refs.map((ref) => <span className="commit-tag" key={ref}>{ref}</span>)}
            </span>
          ) : 'None'}
        </DetailRow>
        <DetailRow label="Author">{formatCommitIdentity(detail.author)}</DetailRow>
        <DetailRow label="Committer">{formatCommitIdentity(detail.committer)}</DetailRow>
        <DetailRow label="Commit Date">
          <time dateTime={detail.committer.date} title={detail.committer.date}>
            {formatCommitDate(detail.committer.date)}
          </time>
        </DetailRow>
        <DetailRow label="Signature">
          <span>{signatureStatusLabel(detail.signature.status)}</span>
          {detail.signature.signer && <span> · {detail.signature.signer}</span>}
          {detail.signature.key && <span> · <code>{detail.signature.key}</code></span>}
        </DetailRow>
      </dl>
    </article>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="commit-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
