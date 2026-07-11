import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CommitList,
  DEFAULT_COLUMNS,
  runLoadMoreCheck,
  shouldLoadMore,
} from '../webview-ui/src/components/CommitList';

const props: Parameters<typeof CommitList>[0] = {
  commits: [],
  columns: DEFAULT_COLUMNS,
  isSelected: () => false,
  onItemClick: () => undefined,
  onItemContextMenu: () => undefined,
  hasMore: true,
  loadingMore: false,
  onLoadMore: () => undefined,
};

// esbuild transpiles TSX without type checking; verify this component API explicitly.
execFileSync(
  './node_modules/.bin/tsc',
  [
    '--noEmit',
    '--jsx', 'react-jsx',
    '--module', 'esnext',
    '--moduleResolution', 'bundler',
    '--target', 'es2022',
    '--strict',
    '--skipLibCheck',
    'test/commitListPagination.tsx',
  ],
  { stdio: 'inherit' }
);

assert.equal(
  renderToStaticMarkup(<CommitList {...props} />),
  '<div class="empty-hint">暂无 commit</div>',
  'empty commit list markup should remain unchanged'
);

assert.equal(shouldLoadMore(true, false, 70, 100, 200), true);
assert.equal(shouldLoadMore(true, false, 69, 100, 200), false);
assert.equal(shouldLoadMore(false, false, 70, 100, 200), false);
assert.equal(shouldLoadMore(true, true, 70, 100, 200), false);

let loadMoreCalls = 0;
assert.equal(runLoadMoreCheck(true, false, 70, 100, 200, () => loadMoreCalls++), true);
assert.equal(loadMoreCalls, 1);
assert.equal(runLoadMoreCheck(true, true, 70, 100, 200, () => loadMoreCalls++), false);
assert.equal(loadMoreCalls, 1);

console.log('commit list pagination component checks passed');
