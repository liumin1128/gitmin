import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Commit } from '../shared/domain';
import {
  CommitList,
  DEFAULT_COLUMNS,
  runAutomaticLoadMoreCheck,
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
  preserveUnresolvedParents: false,
  loadingMore: false,
  automaticLoadEnabled: true,
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
  '<div class="empty-hint">No commits</div>',
  'empty commit list markup should remain unchanged'
);

const graphCommits = [
  {
    hash: 'merge', shortHash: 'merge', message: 'merge', author: '', email: '', date: '',
    parents: ['main-next', 'side'], refs: ['HEAD -> main'], isUnpushed: true,
  },
  {
    hash: 'side', shortHash: 'side', message: 'side', author: '', email: '', date: '',
    parents: [], refs: [], isUnpushed: false,
  },
  {
    hash: 'main-next', shortHash: 'main', message: 'main', author: '', email: '', date: '',
    parents: [], refs: [], isUnpushed: false,
  },
] satisfies Commit[];
const paginatedGraphHtml = renderToStaticMarkup(
  <CommitList
    {...props}
    commits={graphCommits}
    columns={{ graph: true, hash: false, author: false, time: false, tags: false }}
    preserveUnresolvedParents
  />
);
const graphWidths = Array.from(
  paginatedGraphHtml.matchAll(/class="commit-graph[^"]*"[^>]*width="(\d+)"/g),
  (match) => Number(match[1])
);
assert.deepEqual(
  graphWidths,
  [33, 33, 22],
  'each graph row must use its own active-lane width'
);
assert.match(
  paginatedGraphHtml,
  /fill:var\(--vscode-editorWarning-foreground, #cca700\)/,
  'unpushed commits must use the warning color in the graph'
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

assert.equal(
  runAutomaticLoadMoreCheck(false, true, false, 70, 100, 200, () => loadMoreCalls++),
  false,
  'a commit-page error must suppress automatic attachment and resize retries'
);
assert.equal(loadMoreCalls, 1);
assert.equal(
  runLoadMoreCheck(true, false, 70, 100, 200, () => loadMoreCalls++),
  true,
  'a new scroll event must allow a manual retry after a commit-page error'
);
assert.equal(loadMoreCalls, 2);

console.log('commit list pagination component checks passed');
