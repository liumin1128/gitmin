import type { StashEntry } from '../../../shared/domain';
import { t } from '../../../shared/i18n';
import { firstLine, relativeTime } from '../utils/formatters';
import { IconButton } from './common/IconButton';

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
        <IconButton
          icon="refresh"
          title={t('stash.refresh')}
          disabled={busy}
          onClick={onRefresh}
        />
        <IconButton
          icon="run"
          title={t('stash.applySelected')}
          disabled={busy || !hasSelection}
          onClick={onApply}
        />
        <IconButton
          icon="trash"
          title={t('stash.deleteSelected')}
          disabled={busy || !hasSelection}
          onClick={onDelete}
        />
      </div>
      {error && <div className="section-error">{error}</div>}
      {entries.length === 0 ? (
        <div className="empty-hint">{t('stash.none')}</div>
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
