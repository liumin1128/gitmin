import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkingTreeSnapshot } from '../shared/domain';
import { ChangesPanel } from '../webview-ui/src/components/ChangesPanel';

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

console.log('workbench changes component checks passed');
