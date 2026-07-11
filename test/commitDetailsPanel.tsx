import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommitDetailsPanel } from '../webview-ui/src/components/CommitDetailsPanel';
import type { CommitDetails } from '../shared/domain';

const detail: CommitDetails = {
  hash: 'abcdef1234567890',
  shortHash: 'abcdef1',
  treeHash: 'tree1234567890',
  parents: ['parent-one', 'parent-two'],
  refs: ['HEAD -> main', 'tag: v1.0.0'],
  subject: 'feat: add detailed view',
  body: 'First body line\nSecond body line',
  author: { name: 'Alice', email: 'alice@example.com', date: '2026-07-12T09:00:00+08:00' },
  committer: { name: 'Bob', email: 'bob@example.com', date: '2026-07-12T10:00:00+08:00' },
  encoding: 'UTF-8',
  signature: { status: 'G', signer: 'Alice Signer', key: 'ABC123' },
};

assert.match(
  renderToStaticMarkup(<CommitDetailsPanel details={[]} loading={false} error={null} />),
  /Select one or more commits/
);
assert.match(
  renderToStaticMarkup(<CommitDetailsPanel details={[]} loading error={null} />),
  /Loading commit details/
);
assert.match(
  renderToStaticMarkup(<CommitDetailsPanel details={[]} loading={false} error="load failed" />),
  /load failed/
);

const html = renderToStaticMarkup(
  <CommitDetailsPanel details={[detail, { ...detail, hash: 'second-hash', shortHash: 'second' }]} loading={false} error={null} />
);
assert.equal((html.match(/class="commit-detail-item"/g) || []).length, 2);
assert.match(html, /feat: add detailed view/);
assert.match(html, /First body line\nSecond body line/);
assert.match(html, /abcdef1234567890/);
assert.match(html, /HEAD -&gt; main/);
assert.match(html, /Alice &lt;alice@example.com&gt;/);
assert.match(html, /Bob &lt;bob@example.com&gt;/);
assert.match(html, /Good signature/);
assert.match(html, /Alice Signer/);
assert.match(html, /ABC123/);
const headers = html.match(/<header class="commit-detail-header">[\s\S]*?<\/header>/g) ?? [];
assert.equal(headers.length, 2);
headers.forEach((header) => assert.doesNotMatch(header, /<code>/));
assert.doesNotMatch(html, /<dt>Tree<\/dt>/);
assert.doesNotMatch(html, /<dt>Parents<\/dt>/);
assert.doesNotMatch(html, /<dt>Author Date<\/dt>/);
assert.doesNotMatch(html, /<dt>Encoding<\/dt>/);

console.log('commit details panel checks passed');
