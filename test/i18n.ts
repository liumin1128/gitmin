import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  configureLocale,
  getLocale,
  localeLanguageTag,
  resolveLocale,
  t,
  translate,
} from '../shared/i18n';
import { CommitDetailsPanel } from '../webview-ui/src/components/CommitDetailsPanel';

assert.equal(resolveLocale('zh-cn'), 'zh-cn');
assert.equal(resolveLocale('zh-Hans'), 'zh-cn');
assert.equal(resolveLocale('zh_SG'), 'zh-cn');
assert.equal(resolveLocale('zh-tw'), 'en');
assert.equal(resolveLocale('fr'), 'en');
assert.equal(resolveLocale(undefined), 'en');

assert.equal(translate('en', 'view.commits'), 'Commits');
assert.equal(translate('zh-cn', 'view.commits'), '提交');
assert.equal(
  translate('zh-cn', 'filter.branch', { value: 'main' }),
  '分支: main'
);

configureLocale('zh-cn');
assert.equal(getLocale(), 'zh-cn');
assert.equal(localeLanguageTag(), 'zh-CN');
assert.equal(t('panel.expand', { title: '提交' }), '展开提交');
assert.match(
  renderToStaticMarkup(
    createElement(CommitDetailsPanel, { details: [], loading: true, error: null })
  ),
  /正在加载提交详细信息/
);

configureLocale('en');
assert.equal(t('panel.expand', { title: 'Commits' }), 'Expand Commits');

const workspaceRoot = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
const englishNls = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.nls.json'), 'utf8'));
const chineseNls = JSON.parse(
  readFileSync(resolve(workspaceRoot, 'package.nls.zh-cn.json'), 'utf8')
);
const manifestKeys = new Set<string>();
const collectManifestKeys = (value: unknown): void => {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/%([^%]+)%/g)) manifestKeys.add(match[1]!);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(collectManifestKeys);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(collectManifestKeys);
  }
};
collectManifestKeys(manifest);

assert.deepEqual(
  [...manifestKeys].filter((key) => !(key in englishNls)),
  [],
  'package.nls.json must define every package.json localization key'
);
assert.deepEqual(
  [...manifestKeys].filter((key) => !(key in chineseNls)),
  [],
  'package.nls.zh-cn.json must define every package.json localization key'
);
assert.deepEqual(
  Object.keys(chineseNls).sort(),
  Object.keys(englishNls).sort(),
  'package NLS files must expose the same keys'
);

console.log('i18n checks passed');
