import { useState, type MouseEvent } from 'react';
import type {
  WorkingTreeChange,
  WorkingTreeGroup,
} from '../../../shared/domain';
import {
  workingTreeChangeKey,
  type WorkingTreeAction,
} from '../../../shared/workingTree';

interface Props {
  title: string;
  group: WorkingTreeGroup;
  changes: WorkingTreeChange[];
  selectedKeys: ReadonlySet<string>;
  busy: boolean;
  onSelect: (key: string, event: MouseEvent) => void;
  onOpenDiff: (group: WorkingTreeGroup, path: string) => void;
  onAction: (action: WorkingTreeAction, group: WorkingTreeGroup, paths: string[]) => void;
}

export function ChangeGroup({
  title,
  group,
  changes,
  selectedKeys,
  busy,
  onSelect,
  onOpenDiff,
  onAction,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (changes.length === 0) return null;
  const primaryAction: WorkingTreeAction = group === 'staged' ? 'unstage' : 'stage';
  const primaryIcon = group === 'staged' ? 'remove' : 'add';
  const primaryTitle = group === 'staged' ? 'Unstage all changes' : 'Stage all changes';
  const allPaths = changes.map((change) => change.path);
  const selectedPaths = changes
    .filter((change) => selectedKeys.has(workingTreeChangeKey(group, change.path)))
    .map((change) => change.path);
  const contentId = `${group}-change-group-content`;
  const toggleLabel = `${collapsed ? 'Expand' : 'Collapse'} ${title}`;

  return (
    <section
      className={`change-group${collapsed ? ' is-collapsed' : ''}`}
      data-change-group={group}
    >
      <header className="change-group-header">
        <button
          type="button"
          className="change-group-toggle"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span className="change-group-chevron" aria-hidden="true">›</span>
          <span className="change-group-title">{title}</span>
          <span className="change-group-count">{changes.length}</span>
        </button>
        <IconButton
          icon={primaryIcon}
          title={primaryTitle}
          disabled={busy}
          onClick={() => onAction(primaryAction, group, allPaths)}
        />
        <IconButton
          icon="discard"
          title="Discard all changes"
          disabled={busy}
          onClick={() => onAction('discard', group, allPaths)}
        />
      </header>
      {!collapsed && (
        <div id={contentId} className="change-list">
          {changes.map((change) => {
            const key = workingTreeChangeKey(group, change.path);
            const selected = selectedKeys.has(key);
            const actionPaths = selected && selectedPaths.length > 0 ? selectedPaths : [change.path];
            return (
              <div
                key={key}
                className={`change-item status-${change.status}${selected ? ' is-selected' : ''}`}
                aria-selected={selected}
                title={change.oldPath ? `${change.oldPath} -> ${change.path}` : change.path}
                onClick={(event) => {
                  onSelect(key, event);
                  onOpenDiff(group, change.path);
                }}
              >
                <span className="file-status">{change.status}</span>
                <span className="change-path">
                  {change.oldPath && <span className="change-old-path">{change.oldPath} -&gt; </span>}
                  {change.path}
                </span>
                <span className="change-item-actions" onClick={(event) => event.stopPropagation()}>
                  <IconButton
                    icon={primaryIcon}
                    title={group === 'staged' ? 'Unstage changes' : 'Stage changes'}
                    disabled={busy}
                    onClick={() => onAction(primaryAction, group, actionPaths)}
                  />
                  <IconButton
                    icon="discard"
                    title="Discard changes"
                    disabled={busy}
                    onClick={() => onAction('discard', group, actionPaths)}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface IconButtonProps {
  icon: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}

function IconButton({ icon, title, disabled, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-icon-button change-action-button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
    </button>
  );
}
