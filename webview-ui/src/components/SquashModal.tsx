import { useState, useRef, useEffect } from 'react';
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
        <div className="modal-title">Squash Commits</div>
        <div className="modal-subtitle">
          The following {commits.length} commit(s) will be squashed:
        </div>
        <div className="squash-source-list">
          {commits.map((c) => (
            <div key={c.hash} className="squash-source-item">
              <span className="commit-hash">{shortHash(c.hash)}</span>
              <span className="squash-source-msg">{firstLine(c.message)}</span>
            </div>
          ))}
        </div>
        <div className="modal-subtitle">New commit message:</div>
        <textarea
          ref={textareaRef}
          className="squash-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={Math.min(commits.length + 2, 10)}
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={!message.trim()}
          >
            Squash
          </button>
        </div>
      </div>
    </div>
  );
}
