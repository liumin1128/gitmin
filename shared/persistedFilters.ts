import type { CommitFilters } from "./domain";

export function commitFiltersStateKey(rootPath: string): string {
  return `gitmin.commitFilters:${rootPath}`;
}

export function parsePersistedCommitFilters(value: unknown): CommitFilters {
  if (!isRecord(value)) return {};

  const filters: CommitFilters = {};
  if (typeof value.search === "string") filters.search = value.search;
  if (typeof value.searchRegex === "boolean")
    filters.searchRegex = value.searchRegex;
  if (typeof value.searchCaseSensitive === "boolean") {
    filters.searchCaseSensitive = value.searchCaseSensitive;
  }
  if (typeof value.branch === "string") filters.branch = value.branch;
  if (typeof value.author === "string") filters.author = value.author;
  if (typeof value.dateAfter === "string") filters.dateAfter = value.dateAfter;
  if (typeof value.dateBefore === "string")
    filters.dateBefore = value.dateBefore;
  return filters;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
