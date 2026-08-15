import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterBar } from '../webview-ui/src/components/FilterBar';
import { CheckedMenuItem } from '../webview-ui/src/components/CheckedMenuItem';
import { DEFAULT_COLUMNS } from '../webview-ui/src/components/CommitList';
import { ColumnsMenu } from '../webview-ui/src/components/ColumnsMenu';

const props = {
  filters: {},
  options: { branches: [], authors: [] },
  onChange: () => undefined,
  onRefresh: () => undefined,
};

const html = renderToStaticMarkup(<FilterBar {...props} />);
const refreshIndex = html.indexOf('aria-label="Refresh commit list"');

assert.deepEqual(
  DEFAULT_COLUMNS,
  { graph: true, hash: false, author: true, time: false, tags: false },
  'only graph and author columns should be visible by default'
);
assert.notEqual(refreshIndex, -1, 'filter toolbar should render refresh action');
assert.doesNotMatch(html, /title="Display columns"/, 'column settings are optional');
assert.match(html, /codicon-search/, 'search should use the VS Code search icon');
assert.match(html, /codicon-refresh/, 'refresh should use the VS Code refresh icon');
assert.doesNotMatch(html, /🔍/, 'toolbar should not render emoji icons');
assert.doesNotMatch(html, /aria-label="Clear/, 'inactive filters should not render clear actions');
assert.match(
  html,
  /class="filter-bar-controls"[\s\S]*aria-label="Refresh commit list"/,
  'filters and toolbar actions should stay in one controls row'
);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.match(
  styles,
  /\.filter-bar\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*360px\)\s+minmax\(0,\s*1fr\)[^}]*column-gap:\s*6px/s,
  'wide toolbar should use stable search and control columns'
);
assert.match(
  styles,
  /\.filter-bar\s*\{[^}]*position:\s*relative[^}]*flex:\s*0\s+0\s+auto/s,
  'commit filters should occupy a fixed row outside the scrolling list'
);
assert.match(
  styles,
  /\.workbench-panel\[data-workbench-panel='commits'\]\s*>\s*\.workbench-panel-content\s*\{[^}]*overflow:\s*hidden/s,
  'the commit panel content must not own the scrollbar'
);
assert.match(
  styles,
  /\.commit-list-scroll\s*\{[^}]*overflow:\s*auto/s,
  'only the commit list region should scroll'
);
assert.match(
  styles,
  /@media\s*\(max-width:\s*640px\)[\s\S]*?\.filter-bar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*row-gap:\s*4px/s,
  'narrow toolbar should switch directly to two rows'
);
assert.match(
  styles,
  /\.filter-actions\s*>\s*\.toolbar-icon-button,[^}]*\.view-visibility-menu\s*\{[^}]*flex:\s*0\s+0\s+24px/s,
  'toolbar icon buttons should keep their 24px width'
);
assert.match(
  styles,
  /\.filter-options[^}]*\.filter-dropdown-btn\s*\{[^}]*font-size:\s*12px/s,
  'filter labels should use compact toolbar text'
);
assert.match(
  styles,
  /\.checked-menu\s+\.filter-dropdown-panel\s*\{[^}]*min-width:\s*120px[^}]*width:\s*max-content[^}]*border-radius:\s*var\(--vscode-cornerRadius-large,\s*8px\)/s,
  'checked menus should use the compact rounded VS Code menu surface'
);
assert.match(
  styles,
  /\.checked-menu-item\s*\{[^}]*grid-template-columns:\s*16px\s+minmax\(0,\s*1fr\)[^}]*border-radius:\s*var\(--vscode-cornerRadius-small,\s*4px\)/s,
  'checked menu items should reserve a fixed indicator gutter and rounded selection row'
);
assert.match(
  styles,
  /body\.vscode-dark[^}]*\.filter-form-row\s*>\s*input[^}]*\{[^}]*color-scheme:\s*dark/s,
  'date inputs should use a dark native calendar icon in dark themes'
);
assert.match(
  styles,
  /body\.vscode-light[^}]*\.filter-form-row\s*>\s*input[^}]*\{[^}]*color-scheme:\s*light/s,
  'date inputs should use a light native calendar icon in light themes'
);

const activeFiltersHtml = renderToStaticMarkup(
  <FilterBar
    {...props}
    filters={{
      branch: 'main',
      author: 'Alice',
      dateAfter: '2026-07-01',
      dateBefore: '2026-07-12',
    }}
    options={{ branches: ['main'], authors: ['Alice'] }}
  />
);
assert.match(activeFiltersHtml, /aria-label="Clear branch filter"/);
assert.match(activeFiltersHtml, /aria-label="Clear author filter"/);
assert.match(activeFiltersHtml, /aria-label="Clear date filter"/);
assert.equal((activeFiltersHtml.match(/codicon-close/g) ?? []).length, 3);

const checkedItemHtml = renderToStaticMarkup(
  <CheckedMenuItem checked onChange={() => undefined}>Author</CheckedMenuItem>
);
assert.match(checkedItemHtml, /role="menuitemcheckbox"/);
assert.match(checkedItemHtml, /aria-checked="true"/);
assert.match(checkedItemHtml, /codicon-check/);
assert.doesNotMatch(checkedItemHtml, /<input/);

const uncheckedItemHtml = renderToStaticMarkup(
  <CheckedMenuItem checked={false} onChange={() => undefined}>Time</CheckedMenuItem>
);
assert.match(uncheckedItemHtml, /aria-checked="false"/);
assert.doesNotMatch(uncheckedItemHtml, /codicon-check/);

const columnsMenuHtml = renderToStaticMarkup(
  <ColumnsMenu columns={DEFAULT_COLUMNS} onChange={() => undefined} />
);
assert.match(columnsMenuHtml, /codicon-more/, 'column settings should use the VS Code overflow icon');
assert.match(columnsMenuHtml, /aria-haspopup="menu"/);
assert.match(columnsMenuHtml, /aria-expanded="false"/);

const filterWithColumnsHtml = renderToStaticMarkup(
  <FilterBar
    {...props}
    actions={<ColumnsMenu columns={DEFAULT_COLUMNS} onChange={() => undefined} />}
  />
);
assert.ok(
  filterWithColumnsHtml.indexOf('aria-label="Refresh commit list"') <
    filterWithColumnsHtml.indexOf('title="Display columns"'),
  'column settings should render immediately after refresh'
);

const appSource = readFileSync('webview-ui/src/App.tsx', 'utf8');
const columnsMenuSource = readFileSync(
  'webview-ui/src/components/ColumnsMenu.tsx',
  'utf8'
);
const viewVisibilityMenuSource = readFileSync(
  'webview-ui/src/components/ViewVisibilityMenu.tsx',
  'utf8'
);
assert.match(columnsMenuSource, /import \{ CheckedMenu \}/);
assert.match(columnsMenuSource, /<CheckedMenu/);
assert.match(viewVisibilityMenuSource, /import \{ CheckedMenu \}/);
assert.match(viewVisibilityMenuSource, /<CheckedMenu/);
assert.match(
  styles,
  /body\[data-gitmin-host='view'\]\s+\.workbench-toolbar\s*\{[^}]*position:\s*absolute[^}]*width:\s*0[^}]*height:\s*0/s,
  'the sidebar menu anchor should not create a second toolbar row'
);

const filterBarStart = appSource.indexOf('<FilterBar');
const commitListStart = appSource.indexOf('<CommitList', filterBarStart);
assert.notEqual(filterBarStart, -1);
assert.notEqual(commitListStart, -1);
assert.match(
  appSource.slice(filterBarStart, commitListStart),
  /actions=\{<ColumnsMenu[\s\S]*className="commit-list-scroll"/,
  'the fixed toolbar should render before the commit list scroll region'
);

console.log('refresh toolbar checks passed');
