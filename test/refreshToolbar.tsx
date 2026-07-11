import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterBar } from '../webview-ui/src/components/FilterBar';
import { DEFAULT_COLUMNS } from '../webview-ui/src/components/CommitList';

const props = {
  filters: {},
  options: { branches: [], authors: [] },
  onChange: () => undefined,
  columns: DEFAULT_COLUMNS,
  onColumnsChange: () => undefined,
  onRefresh: () => undefined,
};

const html = renderToStaticMarkup(<FilterBar {...props} />);
const refreshIndex = html.indexOf('aria-label="刷新 commit 列表"');
const columnsIndex = html.indexOf('title="显示列"');

assert.equal(DEFAULT_COLUMNS.tags, false, 'tag column should be hidden by default');
assert.notEqual(refreshIndex, -1, 'filter toolbar should render refresh action');
assert.notEqual(columnsIndex, -1, 'filter toolbar should retain column settings');
assert.ok(refreshIndex < columnsIndex, 'refresh action should appear before column settings');
assert.match(
  html,
  /class="filter-bar-controls"[\s\S]*aria-label="刷新 commit 列表"/,
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

console.log('refresh toolbar checks passed');
