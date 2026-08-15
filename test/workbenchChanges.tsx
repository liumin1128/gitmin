import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  notice: 'No local changes to save',
  generating: false,
  commitEnabled: true,
  generateEnabled: true,
  stashEnabled: true,
  onMessageChange: () => undefined,
  onSelect: () => undefined,
  onOpenDiff: () => undefined,
  onAction: () => undefined,
  onCommit: () => undefined,
  onGenerateCommitMessage: () => undefined,
  onStash: () => undefined,
  onRefresh: () => undefined,
};

const html = renderToStaticMarkup(<ChangesPanel {...baseProps} />);
assert.match(html, />Merge Changes</);
assert.match(html, />Staged Changes</);
assert.match(html, />Changes</);
assert.match(html, /<textarea[^>]*rows="1"/);
assert.match(html, /title="Commit staged changes"/);
assert.match(html, /title="Generate commit message with Copilot"/);
assert.match(html, /class="toolbar-icon-button" title="Generate commit message with Copilot"/);
assert.doesNotMatch(html, /<select/);
assert.match(html, /title="Stash changes"/);
assert.match(html, /class="toolbar-icon-button" title="Stash changes" aria-label="Stash changes"/);
assert.doesNotMatch(html, />Stash<\/span>/);
assert.equal((html.match(/class="change-group-toggle"/g) ?? []).length, 3);
assert.match(html, /aria-label="Collapse Staged Changes"[^>]*aria-expanded="true"/);
assert.match(html, /class="change-group-chevron codicon codicon-chevron-down"/);
assert.equal((html.match(/class="change-file-icon codicon codicon-file"/g) ?? []).length, 3);
assert.ok(
  html.indexOf('class="change-file-icon codicon codicon-file"') <
    html.indexOf('class="change-path"') &&
    html.indexOf('class="change-path"') < html.indexOf('class="file-status"'),
  'File icon should precede the path while Git status remains at the end'
);
assert.match(html, /codicon-add/);
assert.match(html, /codicon-remove/);
assert.match(html, /codicon-discard/);
assert.match(html, /codicon-refresh/);
assert.match(html, /codicon-sparkle/);
assert.match(html, /No local changes to save/);
assert.ok(
  html.indexOf('title="Stash changes"') < html.indexOf('class="change-message-controls-spacer"') &&
    html.indexOf('class="change-message-controls-spacer"') <
      html.indexOf('title="Commit staged changes"'),
  'Commit should be the rightmost message action'
);

const disabledHtml = renderToStaticMarkup(
  <ChangesPanel
    {...baseProps}
    snapshot={{ conflicts: [], staged: [], changes: [] }}
    message=" "
    commitEnabled={false}
    generateEnabled={false}
    stashEnabled={false}
  />
);
assert.match(disabledHtml, /title="Commit staged changes"[^>]*disabled/);
assert.match(disabledHtml, /title="Generate commit message with Copilot"[^>]*disabled/);
assert.match(disabledHtml, /title="Stash changes"[^>]*disabled/);

const generatingHtml = renderToStaticMarkup(
  <ChangesPanel {...baseProps} generating busy />
);
assert.match(generatingHtml, /title="Generating commit message with Copilot"/);
assert.match(generatingHtml, /codicon-loading codicon-modifier-spin/);

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

const appSource = readFileSync('webview-ui/src/App.tsx', 'utf8');
const commitsSection = appSource.indexOf("id: 'commits'");
const filterBar = appSource.indexOf('<FilterBar', commitsSection);
const commitList = appSource.indexOf('<CommitList', commitsSection);
assert.ok(commitsSection >= 0 && filterBar > commitsSection && filterBar < commitList);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.doesNotMatch(styles, /\.commit-message-generate-control/);
assert.match(styles, /\.workbench-toolbar\s*\{[^}]*height:\s*26px/s);
assert.match(styles, /\.change-item\s*\{[^}]*min-height:\s*24px/s);
assert.match(
  styles,
  /\.change-item\s*\{[^}]*grid-template-columns:\s*16px\s+minmax\(0,\s*1fr\)\s+auto\s+auto/s
);
assert.match(styles, /\.change-item\s*\{[^}]*padding:\s*0\s+6px\s+0\s+8px/s);
assert.doesNotMatch(styles, /\.change-list::before/);
assert.match(styles, /\.change-group-toggle\s*\{[^}]*padding:\s*0\s+4px\s+0\s+6px/s);
assert.match(styles, /\.change-group-chevron\s*\{[^}]*width:\s*16px[^}]*height:\s*16px/s);
assert.match(styles, /\.change-message-input\s*\{[^}]*resize:\s*none/s);
assert.match(
  styles,
  /\.filter-search,\s*\.change-message-input\s*\{[^}]*flex:\s*1\s+1\s+220px[^}]*max-width:\s*360px[^}]*height:\s*24px/s
);
assert.match(
  styles,
  /\.filter-search-input::placeholder,\s*\.change-message-input::placeholder\s*\{[^}]*--vscode-input-placeholderForeground[^}]*opacity:\s*1/s
);
assert.match(styles, /\.change-message-controls\s*\{[^}]*flex:\s*1\s+1\s+auto/s);
assert.match(
  styles,
  /@media\s*\(max-width:\s*640px\)[\s\S]*?\.change-message-row\s*\{[^}]*flex-direction:\s*column[\s\S]*?\.change-message-input\s*\{[^}]*max-width:\s*100%/s
);
assert.match(styles, /\.stash-item\s*\{[^}]*grid-template-columns:/s);
assert.match(styles, /@media\s*\(max-width:\s*499px\)[\s\S]*\.stash-item/s);
assert.match(styles, /\.status-U\s+\.file-status/);
assert.match(styles, /\.status-T\s+\.file-status/);
assert.match(styles, /\.status-\\\?\s+\.file-status/);

console.log('workbench changes component checks passed');
