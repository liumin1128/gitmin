import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangedFilesPanel } from '../webview-ui/src/components/ChangedFilesPanel';

const html = renderToStaticMarkup(
  <ChangedFilesPanel
    range={{ base: 'base', head: 'head', contiguous: true }}
    files={[
      { path: 'a.ts', status: 'M', insertions: 1, deletions: 0, binary: false },
      { path: 'b.ts', status: 'M', insertions: 1, deletions: 0, binary: false },
    ]}
    activeFilePath="b.ts"
    loading={false}
    onOpenDiff={() => undefined}
  />
);

assert.match(html, /class="file-item status-M is-active"[^>]*aria-current="true"/);
assert.doesNotMatch(html, /title="a\.ts"[^>]*aria-current="true"/);

console.log('changed files active state checks passed');
