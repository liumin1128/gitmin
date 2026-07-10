/**
 * commit 搜索纯函数
 * - 只处理 search + searchRegex + searchCaseSensitive
 * - 匹配范围：commit.message 与 commit.hash（含前缀）
 * - 非法正则退化为返回全部（不抛错，UI 层可用 isValidSearch 提示）
 */
import type { Commit, CommitFilters } from './domain';

export function applySearch(commits: Commit[], filters?: CommitFilters): Commit[] {
  if (!filters) return commits;
  const q = filters.search?.trim();
  if (!q) return commits;

  const matcher = buildMatcher(q, !!filters.searchRegex, !!filters.searchCaseSensitive);
  if (!matcher) return commits;

  return commits.filter((c) => matcher(c.message) || matcher(c.hash) || matcher(c.shortHash));
}

/** 搜索关键字是否是合法输入（非空 + 若开启 regex 则可编译） */
export function isValidSearch(q: string, useRegex: boolean): boolean {
  if (!q) return true;
  if (!useRegex) return true;
  try {
    new RegExp(q);
    return true;
  } catch {
    return false;
  }
}

type Matcher = (text: string) => boolean;

function buildMatcher(q: string, useRegex: boolean, caseSensitive: boolean): Matcher | null {
  if (useRegex) {
    try {
      const re = new RegExp(q, caseSensitive ? '' : 'i');
      return (text) => re.test(text);
    } catch {
      return null;
    }
  }
  if (caseSensitive) {
    return (text) => text.includes(q);
  }
  const lower = q.toLowerCase();
  return (text) => text.toLowerCase().includes(lower);
}
