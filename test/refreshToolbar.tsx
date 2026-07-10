import assert from 'node:assert/strict';
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

assert.notEqual(refreshIndex, -1, 'filter toolbar should render refresh action');
assert.notEqual(columnsIndex, -1, 'filter toolbar should retain column settings');
assert.ok(refreshIndex < columnsIndex, 'refresh action should appear before column settings');

console.log('refresh toolbar checks passed');
