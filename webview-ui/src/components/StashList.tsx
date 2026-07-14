import type { StashEntry } from '../../../shared/domain';
import { firstLine, relativeTime } from '../utils/formatters';

interface Props {
  entries: StashEntry[];
  selectedHash: string | null;
  busy: boolean;
  error: string | null;
  onSelect: (entry: StashEntry) => void;
  onRefresh: () => void;
  onApply: () => void;
  onDelete: () => void;
}

export function StashList({
  entries,
  selectedHash,
  busy,
  error,
  onSelect,
  onRefresh,
  onApply,
  onDelete,
}: Props) {
  const hasSelection = selectedHash !== null;
  return (
    <div className="stashes-panel">
      <div className="stash-toolbar">
        <span className="stash-toolbar-spacer" />
        <StashActionButton
          icon="refresh"
          title="Refresh stashes"
          disabled={busy}
          onClick={onRefresh}
        />
        <StashActionButton
          icon="run"
          title="Apply selected stash"
          disabled={busy || !hasSelection}
          onClick={onApply}
        />
        <StashActionButton
          icon="trash"
          title="Delete selected stash"
          disabled={busy || !hasSelection}
          onClick={onDelete}
        />
      </div>
      {error && <div className="section-error">{error}</div>}
      {entries.length === 0 ? (
        <div className="empty-hint">No stashes</div>
      ) : (
        <div className="stash-list">
          {entries.map((entry) => {
            const selected = entry.hash === selectedHash;
            return (
              <div
                key={entry.hash}
                className={`stash-item${selected ? ' is-selected' : ''}`}
                aria-selected={selected}
                title={entry.message}
                onClick={() => onSelect(entry)}
              >
                <code className="stash-selector">{entry.selector}</code>
                <span className="stash-message">{firstLine(entry.message)}</span>
                <time className="stash-time" dateTime={entry.date} title={entry.date}>
                  {relativeTime(entry.date)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface StashActionButtonProps {
  icon: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}

function StashActionButton({ icon, title, disabled, onClick }: StashActionButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-icon-button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
    </button>
  );
}
