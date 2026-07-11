import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommitList, DEFAULT_COLUMNS } from '../webview-ui/src/components/CommitList';

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

console.log('commit list pagination component checks passed');
