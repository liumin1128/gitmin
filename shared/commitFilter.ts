/**
 * Commit search pure functions
 * - Only handles search + searchRegex + searchCaseSensitive
 * - Matches against: commit.message and commit.hash (including prefix)
 * - Invalid regex degrades to returning all (no error thrown, UI can use isValidSearch for hints)
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

/** Check if search input is valid (non-empty + if regex enabled, must compile) */
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
