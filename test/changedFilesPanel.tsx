import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangedFilesPanel } from '../webview-ui/src/components/ChangedFilesPanel';
import { getFileCodicon } from '../webview-ui/src/utils/fileIcon';

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

assert.match(html, /class="file-change-row status-M is-active"[^>]*aria-current="true"/);
assert.match(html, /class="file-type-icon codicon codicon-file-code"/);
assert.doesNotMatch(html, /title="a\.ts"[^>]*aria-current="true"/);
assert.ok(html.indexOf('class="file-stat"') < html.indexOf('class="file-status"'));

assert.equal(getFileCodicon('README.md'), 'markdown');
assert.equal(getFileCodicon('Jenkinsfile'), 'file-code');
assert.equal(getFileCodicon('assets/logo.png'), 'file-media');
assert.equal(getFileCodicon('notes.txt'), 'file-text');

console.log('changed files active state checks passed');
