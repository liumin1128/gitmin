import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkingTreeSnapshot } from '../shared/domain';
import { ChangesPanel } from '../webview-ui/src/components/ChangesPanel';
import { StashList } from '../webview-ui/src/components/StashList';

const snapshot: WorkingTreeSnapshot = {
  conflicts: [{ path: 'conflict.ts', status: 'U', group: 'conflicts' }],
  staged: [{ path: 'staged.ts', status: 'M', group: 'staged' }],
  changes: [{ path: 'new.ts', status: '?', group: 'changes' }],
};

const baseProps: Parameters<typeof ChangesPanel>[0] = {
  snapshot,
  message: 'ship it',
  selectedKeys: new Set(),
  busy: false,
  error: null,
  commitEnabled: true,
  stashEnabled: true,
  onMessageChange: () => undefined,
  onSelect: () => undefined,
  onOpenDiff: () => undefined,
  onAction: () => undefined,
  onCommit: () => undefined,
  onStash: () => undefined,
  onRefresh: () => undefined,
};

const html = renderToStaticMarkup(<ChangesPanel {...baseProps} />);
assert.match(html, />Merge Changes</);
assert.match(html, />Staged Changes</);
assert.match(html, />Changes</);
assert.match(html, /<textarea[^>]*rows="1"/);
assert.match(html, /title="Commit staged changes"/);
assert.match(html, /title="Stash changes"/);
assert.match(html, /codicon-add/);
assert.match(html, /codicon-remove/);
assert.match(html, /codicon-discard/);
assert.match(html, /codicon-refresh/);

const disabledHtml = renderToStaticMarkup(
  <ChangesPanel
    {...baseProps}
    snapshot={{ conflicts: [], staged: [], changes: [] }}
    message=" "
    commitEnabled={false}
    stashEnabled={false}
  />
);
assert.match(disabledHtml, /title="Commit staged changes"[^>]*disabled/);
assert.match(disabledHtml, /title="Stash changes"[^>]*disabled/);

const stashEntries = [
  {
    selector: 'stash@{0}',
    hash: 'abc123',
    parentHash: 'parent0',
    message: 'On main: checkpoint',
    date: '2026-07-14T10:00:00+08:00',
  },
  {
    selector: 'stash@{1}',
    hash: 'def456',
    parentHash: 'parent1',
    message: 'WIP on main: subject',
    date: '2026-07-13T10:00:00+08:00',
  },
];
const stashHtml = renderToStaticMarkup(
  <StashList
    entries={stashEntries}
    selectedHash="abc123"
    busy={false}
    error={null}
    onSelect={() => undefined}
    onRefresh={() => undefined}
    onApply={() => undefined}
    onDelete={() => undefined}
  />
);
assert.match(stashHtml, /stash@\{0\}/);
assert.match(stashHtml, /checkpoint/);
assert.match(stashHtml, /class="stash-item is-selected"/);
assert.match(stashHtml, /title="Refresh stashes"/);
assert.match(stashHtml, /title="Apply selected stash"/);
assert.match(stashHtml, /title="Delete selected stash"/);

const noStashSelectionHtml = renderToStaticMarkup(
  <StashList
    entries={stashEntries}
    selectedHash={null}
    busy={false}
    error={null}
    onSelect={() => undefined}
    onRefresh={() => undefined}
    onApply={() => undefined}
    onDelete={() => undefined}
  />
);
assert.match(noStashSelectionHtml, /title="Apply selected stash"[^>]*disabled/);
assert.match(noStashSelectionHtml, /title="Delete selected stash"[^>]*disabled/);

console.log('workbench changes component checks passed');
