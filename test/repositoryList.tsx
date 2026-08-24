import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepositoryList } from '../webview-ui/src/components/RepositoryList';

const html = renderToStaticMarkup(
  <RepositoryList
    repositories={[
      { rootPath: '/workspace/api', name: 'api', currentBranch: 'main' },
      { rootPath: '/workspace/web', name: 'web', currentBranch: 'feature/repos' },
    ]}
    selectedRootPath="/workspace/web"
    pendingRootPath={null}
    onSelect={() => undefined}
  />
);

assert.match(html, /class="repository-item"[^>]*aria-pressed="false"/);
assert.match(html, /class="repository-item is-selected"[^>]*aria-pressed="true"/);
assert.match(html, /codicon-repo/);
assert.match(html, /codicon-git-branch/);
assert.match(html, /codicon-check/);
assert.match(html, />feature\/repos</);
assert.ok(html.indexOf('>api<') < html.indexOf('>web<'));

const appSource = readFileSync('webview-ui/src/App.tsx', 'utf8');
const stackStart = appSource.indexOf('<WorkbenchPanelStack');
const repositoriesPane = appSource.indexOf("id: 'repositories'", stackStart);
const changesPane = appSource.indexOf("id: 'changes'", stackStart);
assert.ok(
  stackStart >= 0 && repositoriesPane > stackStart && repositoriesPane < changesPane,
  'Repositories must be the first same-level workbench pane'
);

const styles = readFileSync('webview-ui/src/styles.css', 'utf8');
assert.doesNotMatch(styles, /\.repository-section\s*\{/);
assert.doesNotMatch(styles, /\.section-error\s*\{/);
assert.match(styles, /\.repository-item\s*\{[^}]*grid-template-columns:/s);
assert.match(styles, /\.repository-item\.is-selected\s*\{[^}]*list-activeSelectionBackground/s);

console.log('repository list checks passed');
