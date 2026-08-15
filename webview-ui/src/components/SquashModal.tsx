import { useState, useRef, useEffect } from 'react';
import { t } from '../../../shared/i18n';
import { shortHash, firstLine } from '../utils/formatters';

interface SquashCommit {
  hash: string;
  message: string;
}

interface Props {
  commits: SquashCommit[];
  onConfirm: (message: string) => void;
  onCancel: () => void;
}

export function SquashModal({ commits, onConfirm, onCancel }: Props) {
  const initialMessage = commits.map((c) => c.message).join('\n');
  const [message, setMessage] = useState(initialMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-body"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-title">{t('squash.title')}</div>
        <div className="modal-subtitle">
          {t('squash.summary', { count: commits.length })}
        </div>
        <div className="squash-source-list">
          {commits.map((c) => (
            <div key={c.hash} className="squash-source-item">
              <span className="commit-hash">{shortHash(c.hash)}</span>
              <span className="squash-source-msg">{firstLine(c.message)}</span>
            </div>
          ))}
        </div>
        <div className="modal-subtitle">{t('squash.newMessage')}</div>
        <textarea
          ref={textareaRef}
          className="squash-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={Math.min(commits.length + 2, 10)}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={!message.trim()}
          >
            {t('common.squash')}
          </button>
        </div>
      </div>
    </div>
  );
}
