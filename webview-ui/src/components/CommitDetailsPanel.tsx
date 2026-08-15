import { useState, type ReactNode } from 'react';
import type { CommitDetails } from '../../../shared/domain';
import { t } from '../../../shared/i18n';
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
  if (loading) return <div className="empty-hint">{t('details.loading')}</div>;
  if (error) return <div className="commit-details-error">{error}</div>;
  if (details.length === 0) {
    return <div className="empty-hint">{t('details.select')}</div>;
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
  const [messageExpanded, setMessageExpanded] = useState(false);
  const hasBody = detail.body.trim().length > 0;
  const messageId = `commit-message-${detail.hash}`;
  const toggleLabel = t(
    messageExpanded ? 'details.collapseMessage' : 'details.expandMessage'
  );

  return (
    <article className="commit-detail-item">
      <header className="commit-detail-header">
        <h3>{detail.subject || t('details.noSubject')}</h3>
        {hasBody && (
          <button
            type="button"
            className="toolbar-icon-button commit-detail-message-toggle"
            title={toggleLabel}
            aria-label={toggleLabel}
            aria-expanded={messageExpanded}
            aria-controls={messageId}
            onClick={() => setMessageExpanded((expanded) => !expanded)}
          >
            <span
              className={`codicon codicon-chevron-${messageExpanded ? 'down' : 'right'}`}
              aria-hidden="true"
            />
          </button>
        )}
      </header>

      {hasBody && messageExpanded && (
        <pre id={messageId} className="commit-detail-body">{detail.body}</pre>
      )}

      <dl className="commit-detail-grid">
        <DetailRow label={t('details.hash')}><code>{detail.hash}</code></DetailRow>
        <DetailRow label={t('details.refs')}>
          {detail.refs.length > 0 ? (
            <span className="commit-detail-refs">
              {detail.refs.map((ref) => <span className="commit-tag" key={ref}>{ref}</span>)}
            </span>
          ) : t('common.none')}
        </DetailRow>
        <DetailRow label={t('details.author')}>{formatCommitIdentity(detail.author)}</DetailRow>
        <DetailRow label={t('details.committer')}>{formatCommitIdentity(detail.committer)}</DetailRow>
        <DetailRow label={t('details.commitDate')}>
          <time dateTime={detail.committer.date} title={detail.committer.date}>
            {formatCommitDate(detail.committer.date)}
          </time>
        </DetailRow>
        <DetailRow label={t('details.signature')}>
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
