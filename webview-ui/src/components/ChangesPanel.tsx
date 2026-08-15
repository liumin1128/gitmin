import { useRef, type ChangeEvent, type MouseEvent } from 'react';
import type {
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from '../../../shared/domain';
import {
  workingTreeChangeCount,
  type WorkingTreeAction,
} from '../../../shared/workingTree';
import { t } from '../../../shared/i18n';
import { ChangeGroup } from './ChangeGroup';
import { IconButton } from './common/IconButton';

interface Props {
  snapshot: WorkingTreeSnapshot;
  message: string;
  selectedKeys: ReadonlySet<string>;
  busy: boolean;
  generating: boolean;
  error: string | null;
  notice: string | null;
  commitEnabled: boolean;
  generateEnabled: boolean;
  stashEnabled: boolean;
  onMessageChange: (message: string) => void;
  onSelect: (key: string, event: MouseEvent) => void;
  onOpenDiff: (group: WorkingTreeGroup, path: string) => void;
  onAction: (action: WorkingTreeAction, group: WorkingTreeGroup, paths: string[]) => void;
  onCommit: () => void;
  onGenerateCommitMessage: () => void;
  onStash: () => void;
  onRefresh: () => void;
}

export function ChangesPanel({
  snapshot,
  message,
  selectedKeys,
  busy,
  generating,
  error,
  notice,
  commitEnabled,
  generateEnabled,
  stashEnabled,
  onMessageChange,
  onSelect,
  onOpenDiff,
  onAction,
  onCommit,
  onGenerateCommitMessage,
  onStash,
  onRefresh,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const changeCount = workingTreeChangeCount(snapshot);
  const locked = busy || generating;

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
          placeholder={t('changes.messagePlaceholder')}
          aria-label={t('changes.messageLabel')}
          disabled={locked}
          onChange={handleMessageChange}
        />
        <div className="change-message-controls">
          <IconButton
            icon={generating ? 'loading' : 'sparkle'}
            spin={generating}
            title={
              generating
                ? t('changes.generatingMessage')
                : t('changes.generateMessage')
            }
            disabled={locked || !generateEnabled}
            onClick={onGenerateCommitMessage}
          />
          <IconButton
            icon="archive"
            title={t('changes.stash')}
            disabled={locked || !stashEnabled}
            onClick={onStash}
          />
          <IconButton
            icon="refresh"
            title={t('changes.refresh')}
            disabled={locked}
            onClick={onRefresh}
          />
          <span className="change-message-controls-spacer" />
          <button
            type="button"
            className="btn change-command-button"
            title={t('changes.commitStaged')}
            disabled={locked || !commitEnabled}
            onClick={onCommit}
          >
            <span className="codicon codicon-check" aria-hidden="true" />
            <span>{t('changes.commit')}</span>
          </button>
        </div>
      </div>
      {error && <div className="section-error">{error}</div>}
      {!error && notice && <div className="section-notice">{notice}</div>}
      <div className="change-groups">
        {changeCount === 0 ? (
          <div className="empty-hint">{t('changes.none')}</div>
        ) : (
          <>
            <ChangeGroup
              title={t('view.mergeChanges')}
              group="conflicts"
              changes={snapshot.conflicts}
              selectedKeys={selectedKeys}
              busy={locked}
              onSelect={onSelect}
              onOpenDiff={onOpenDiff}
              onAction={onAction}
            />
            <ChangeGroup
              title={t('view.stagedChanges')}
              group="staged"
              changes={snapshot.staged}
              selectedKeys={selectedKeys}
              busy={locked}
              onSelect={onSelect}
              onOpenDiff={onOpenDiff}
              onAction={onAction}
            />
            <ChangeGroup
              title={t('view.changes')}
              group="changes"
              changes={snapshot.changes}
              selectedKeys={selectedKeys}
              busy={locked}
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
