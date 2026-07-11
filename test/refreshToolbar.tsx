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

assert.equal(DEFAULT_COLUMNS.tags, false, 'tag column should be hidden by default');
assert.notEqual(refreshIndex, -1, 'filter toolbar should render refresh action');
assert.doesNotMatch(html, /title="Display columns"/, 'column settings belongs to the commit panel header');
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
  /\.filter-bar\s*\{[^}]*flex-wrap:\s*nowrap/s,
  'wide toolbar must never partially wrap'
);
assert.match(
  styles,
  /@media\s*\(max-width:\s*640px\)[\s\S]*?\.filter-bar\s*\{[^}]*flex-direction:\s*column/s,
  'narrow toolbar should switch directly to two rows'
);
assert.match(
  styles,
  /\.filter-bar-controls\s*>\s*\.toolbar-icon-button,[^}]*\.view-visibility-menu\s*\{[^}]*flex:\s*0\s+0\s+24px/s,
  'toolbar icon buttons should keep their 24px width'
);
assert.match(
  styles,
  /\.filter-bar-controls[^}]*\.filter-dropdown-btn\s*\{[^}]*font-size:\s*12px/s,
  'filter labels should use compact toolbar text'
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
assert.doesNotMatch(checkedItemHtml, /<input/);

const columnsMenuHtml = renderToStaticMarkup(
  <ColumnsMenu columns={DEFAULT_COLUMNS} onChange={() => undefined} />
);
assert.match(columnsMenuHtml, /codicon-more/, 'column settings should use the VS Code overflow icon');

const appSource = readFileSync('webview-ui/src/App.tsx', 'utf8');
const commitSectionStart = appSource.indexOf('id="commits"');
const commitListStart = appSource.indexOf('<CommitList', commitSectionStart);
assert.notEqual(commitSectionStart, -1);
assert.notEqual(commitListStart, -1);
assert.match(
  appSource.slice(commitSectionStart, commitListStart),
  /<ColumnsMenu/,
  'column settings should render in the commit panel header actions'
);

console.log('refresh toolbar checks passed');
