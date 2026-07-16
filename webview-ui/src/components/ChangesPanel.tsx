import { useRef, type ChangeEvent, type MouseEvent } from 'react';
import type {
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from '../../../shared/domain';
import type { WorkingTreeAction } from '../../../shared/workingTree';
import { ChangeGroup } from './ChangeGroup';

interface Props {
  snapshot: WorkingTreeSnapshot;
  message: string;
  selectedKeys: ReadonlySet<string>;
  busy: boolean;
  error: string | null;
  notice: string | null;
  commitEnabled: boolean;
  stashEnabled: boolean;
  onMessageChange: (message: string) => void;
  onSelect: (key: string, event: MouseEvent) => void;
  onOpenDiff: (group: WorkingTreeGroup, path: string) => void;
  onAction: (action: WorkingTreeAction, group: WorkingTreeGroup, paths: string[]) => void;
  onCommit: () => void;
  onStash: () => void;
  onRefresh: () => void;
}

export function ChangesPanel({
  snapshot,
  message,
  selectedKeys,
  busy,
  error,
  notice,
  commitEnabled,
  stashEnabled,
  onMessageChange,
  onSelect,
  onOpenDiff,
  onAction,
  onCommit,
  onStash,
  onRefresh,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const changeCount =
    snapshot.conflicts.length + snapshot.staged.length + snapshot.changes.length;

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    onMessageChange(input.value);
  };

  return (
    <div className="changes-panel">
      <div className="change-message-row">
        <textarea
          ref={inputRef}
          className="change-message-input"
          rows={1}
          value={message}
          placeholder="Message"
          aria-label="Commit or stash message"
          disabled={busy}
          onChange={handleMessageChange}
        />
        <div className="change-message-controls">
          <button
            type="button"
            className="toolbar-icon-button"
            title="Stash changes"
            aria-label="Stash changes"
            disabled={busy || !stashEnabled}
            onClick={onStash}
          >
            <span className="codicon codicon-archive" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="toolbar-icon-button"
            title="Refresh changes"
            aria-label="Refresh changes"
            disabled={busy}
            onClick={onRefresh}
          >
            <span className="codicon codicon-refresh" aria-hidden="true" />
          </button>
          <span className="change-message-controls-spacer" />
          <button
            type="button"
            className="btn change-command-button"
            title="Commit staged changes"
            disabled={busy || !commitEnabled}
            onClick={onCommit}
          >
            <span className="codicon codicon-check" aria-hidden="true" />
            <span>Commit</span>
          </button>
        </div>
      </div>
      {error && <div className="section-error">{error}</div>}
      {!error && notice && <div className="section-notice">{notice}</div>}
      <div className="change-groups">
        {changeCount === 0 ? (
          <div className="empty-hint">No changes</div>
        ) : (
          <>
            <ChangeGroup
              title="Merge Changes"
              group="conflicts"
              changes={snapshot.conflicts}
              selectedKeys={selectedKeys}
              busy={busy}
              onSelect={onSelect}
              onOpenDiff={onOpenDiff}
              onAction={onAction}
            />
            <ChangeGroup
              title="Staged Changes"
              group="staged"
              changes={snapshot.staged}
              selectedKeys={selectedKeys}
              busy={busy}
              onSelect={onSelect}
              onOpenDiff={onOpenDiff}
              onAction={onAction}
            />
            <ChangeGroup
              title="Changes"
              group="changes"
              changes={snapshot.changes}
              selectedKeys={selectedKeys}
              busy={busy}
              onSelect={onSelect}
              onOpenDiff={onOpenDiff}
              onAction={onAction}
            />
          </>
        )}
      </div>
    </div>
  );
}
